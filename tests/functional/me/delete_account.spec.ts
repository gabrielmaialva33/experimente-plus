import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiResponse } from '@japa/api-client'

import RefreshToken from '#modules/auth/models/refresh_token'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import PermissionService from '#modules/permissions/services/permission_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import User from '#modules/users/models/user'

function assertPrivateResponse(response: ApiResponse): void {
  response.assertHeader('cache-control', 'private, no-store')
  response.assertHeader('pragma', 'no-cache')
  response.assertHeader('x-robots-tag', 'noindex, nofollow')
  response.assertHeader('referrer-policy', 'no-referrer')
}

test.group('Delete own account', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function currentEpoch(cache: PermissionCacheService, userId: number): Promise<string> {
    const snapshot = await cache.getUserPermissionsSnapshot(userId)
    return snapshot.epoch
  }

  test('should anonymize the user and revoke every active credential', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      full_name: 'Delete Me',
      email: 'delete-me@example.com',
      username: 'delete-me',
      password: 'password123',
    })
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    await user.related('roles').attach([userRole.id])
    const permissionService = await app.container.make(PermissionService)
    const permissionCache = await app.container.make(PermissionCacheService)
    const warmedPermissions = await permissionService.getEffectivePermissions(user.id)
    assert.isAbove(warmedPermissions.length, 0)
    const epochBefore = await currentEpoch(permissionCache, user.id)

    const signIn = await client.post('/api/v1/sessions/sign-in').json({
      uid: user.email,
      password: 'password123',
    })
    signIn.assertStatus(200)
    const accessToken = signIn.body().auth.access_token as string
    const refreshToken = signIn.body().auth.refresh_token as string

    const response = await client.delete('/api/v1/me').bearerToken(accessToken).json({
      current_password: 'password123',
      confirmation: 'EXCLUIR MINHA CONTA',
    })

    response.assertStatus(204)
    assertPrivateResponse(response)
    const epochAfter = await currentEpoch(permissionCache, user.id)
    assert.equal(BigInt(epochAfter), BigInt(epochBefore) + 1n)
    assert.deepEqual(await permissionService.getEffectivePermissions(user.id), [])

    assert.isNull(await User.find(user.id))
    const rawUser = await db.from('users').where('id', user.id).firstOrFail()
    assert.isTrue(rawUser.is_deleted)
    assert.equal(rawUser.full_name, 'Deleted User')
    assert.match(rawUser.email, /^deleted\+/)
    assert.notEqual(rawUser.email, 'delete-me@example.com')
    assert.match(rawUser.username, /^deleted_/)

    const storedRefresh = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNotNull(storedRefresh.revoked_at)

    const access = await client.get('/api/v1/me').bearerToken(accessToken)
    access.assertStatus(401)

    const refresh = await client.post('/api/v1/sessions/refresh').json({
      refresh_token: refreshToken,
    })
    refresh.assertStatus(401)
  })

  test('should reject an invalid password or confirmation without deleting the account', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      full_name: 'Keep Me',
      email: 'keep-me@example.com',
      username: 'keep-me',
      password: 'password123',
    })

    for (const payload of [
      { current_password: 'wrong-password', confirmation: 'EXCLUIR MINHA CONTA' },
      { current_password: 'password123', confirmation: 'MANTER MINHA CONTA' },
    ]) {
      const response = await client.delete('/api/v1/me').loginAs(user).json(payload)
      response.assertStatus(400)
    }

    const persisted = await User.find(user.id)
    assert.isNotNull(persisted)
    assert.equal(persisted!.email, user.email)
  })

  test('should preserve the last active platform root', async ({ client, assert }) => {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const root = await User.create({
      full_name: 'Last Root',
      email: 'last-root@example.com',
      username: 'last-root',
      password: 'password123',
    })
    await root.related('roles').attach([rootRole.id])
    const permissionService = await app.container.make(PermissionService)
    const permissionCache = await app.container.make(PermissionCacheService)
    const warmedPermissions = await permissionService.getEffectivePermissions(root.id)
    assert.isAbove(warmedPermissions.length, 0)
    const epochBefore = await currentEpoch(permissionCache, root.id)

    const response = await client.delete('/api/v1/me').loginAs(root).json({
      current_password: 'password123',
      confirmation: 'EXCLUIR MINHA CONTA',
    })

    response.assertStatus(400)
    response.assertBodyContains({ message: 'The last active root user cannot be deleted' })
    assertPrivateResponse(response)

    const persisted = await User.find(root.id)
    assert.isNotNull(persisted)
    assert.equal(persisted!.email, root.email)
    const rootAssignment = await db
      .from('user_roles')
      .where('user_id', root.id)
      .where('role_id', rootRole.id)
      .first()
    assert.isNotNull(rootAssignment)
    assert.equal(await currentEpoch(permissionCache, root.id), epochBefore)
  })

  test('reads deletion credentials only from the request body', async ({ client, assert }) => {
    const user = await User.create({
      full_name: 'Delete Body Source',
      email: 'delete-body-source@example.com',
      username: 'delete-body-source',
      password: 'password123',
    })

    const queryOnly = await client
      .delete('/api/v1/me')
      .loginAs(user)
      .qs({
        current_password: 'password123',
        confirmation: 'EXCLUIR MINHA CONTA',
      })
      .json({})
    queryOnly.assertStatus(422)
    queryOnly.assertBodyContains({
      errors: [
        { field: 'current_password', rule: 'required' },
        { field: 'confirmation', rule: 'required' },
      ],
    })

    const bodyWins = await client
      .delete('/api/v1/me')
      .loginAs(user)
      .qs({
        current_password: 'wrong-query-password',
        confirmation: 'MANTER MINHA CONTA',
      })
      .json({
        current_password: 'password123',
        confirmation: 'EXCLUIR MINHA CONTA',
      })
    bodyWins.assertStatus(204)
    assertPrivateResponse(bodyWins)

    assert.isNull(await User.find(user.id))
  })

  test('reads settings deletion credentials only from the request body', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      full_name: 'Settings Delete Body Source',
      email: 'settings-delete-body-source@example.com',
      username: 'settings-delete-body-source',
      password: 'password123',
    })
    const validCredentials = {
      current_password: 'password123',
      confirmation: 'EXCLUIR MINHA CONTA',
    }

    const queryOnly = await client
      .delete('/settings/account')
      .withCsrfToken()
      .header('referer', '/settings')
      .redirects(0)
      .loginAs(user)
      .qs(validCredentials)
      .form({})

    queryOnly.assertStatus(302)
    queryOnly.assertHeader('location', '/settings')
    assert.isNotNull(await User.find(user.id))

    const safeConflict = await client
      .delete('/settings/account')
      .withCsrfToken()
      .header('referer', '/settings')
      .redirects(0)
      .loginAs(user)
      .qs(validCredentials)
      .form({
        current_password: 'wrong-body-password',
        confirmation: 'EXCLUIR MINHA CONTA',
      })

    safeConflict.assertStatus(302)
    safeConflict.assertHeader('location', '/settings')
    safeConflict.assertFlashMessage('errors', {
      general: 'A senha atual está incorreta',
    })
    assert.isNotNull(await User.find(user.id))

    const bodyWins = await client
      .delete('/settings/account')
      .withCsrfToken()
      .header('referer', '/settings')
      .redirects(0)
      .loginAs(user)
      .qs({
        current_password: 'wrong-query-password',
        confirmation: 'MANTER MINHA CONTA',
      })
      .form(validCredentials)

    bodyWins.assertStatus(302)
    bodyWins.assertHeader('location', '/')
    assert.isNull(await User.find(user.id))
  })
})
