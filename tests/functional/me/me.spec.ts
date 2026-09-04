import { test } from '@japa/runner'
import type { ApiResponse } from '@japa/api-client'

import testUtils from '@adonisjs/core/services/test_utils'

import Role from '#modules/roles/models/role'
import User from '#modules/users/models/user'
import Permission from '#modules/permissions/models/permission'

import IRole from '#modules/roles/interfaces/role_interface'
import IPermission from '#modules/permissions/interfaces/permission_interface'

function assertPrivateResponse(response: ApiResponse): void {
  response.assertHeader('cache-control', 'private, no-store')
  response.assertHeader('pragma', 'no-cache')
  response.assertHeader('x-robots-tag', 'noindex, nofollow')
  response.assertHeader('referrer-policy', 'no-referrer')
}

test.group('Me endpoints', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET /me should return current user profile', async ({ client, assert }) => {
    // Create user with a role
    const user = await User.create({
      full_name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    })

    const role = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user',
      }
    )
    await user.related('roles').attach([role.id])

    const response = await client.get('/api/v1/me').loginAs(user)

    response.assertStatus(200)
    assertPrivateResponse(response)
    assert.equal(response.body().email, 'test@example.com')
    assert.equal(response.body().username, 'testuser')
    assert.isArray(response.body().roles)
    assert.equal(response.body().roles[0].name, 'User')
  })

  test('GET /me/permissions should return user permissions', async ({ client, assert }) => {
    // Create user with role
    const user = await User.create({
      full_name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    })

    const role = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user',
      }
    )
    await user.related('roles').attach([role.id])

    // Add direct permission
    const permission = await Permission.firstOrCreate(
      {
        resource: IPermission.Resources.USERS,
        action: IPermission.Actions.READ,
      },
      {
        name: 'users.read',
        resource: IPermission.Resources.USERS,
        action: IPermission.Actions.READ,
        description: 'Read users',
      }
    )
    await user.related('permissions').attach({
      [permission.id]: {
        granted: true,
      },
    })
    const rolePermission = await Permission.firstOrCreate(
      {
        resource: IPermission.Resources.USERS,
        action: IPermission.Actions.LIST,
      },
      {
        name: 'users.list',
        resource: IPermission.Resources.USERS,
        action: IPermission.Actions.LIST,
        description: null,
      }
    )
    await role.related('permissions').attach([rolePermission.id])

    const response = await client.get('/api/v1/me/permissions').loginAs(user)

    response.assertStatus(200)
    assertPrivateResponse(response)
    assert.isNumber(response.body().total)
    assert.isArray(response.body().permissions)
    assert.isObject(response.body().grouped)

    // Check if permission exists in response
    const hasUsersRead = response.body().permissions.some((p: any) => p.name === 'users.read')
    assert.isTrue(hasUsersRead)
    assert.deepEqual(Object.keys(response.body()).sort(), ['grouped', 'permissions', 'total'])

    const direct = response.body().permissions.find((item: any) => item.id === permission.id)
    const inherited = response.body().permissions.find((item: any) => item.id === rolePermission.id)
    assert.deepEqual(Object.keys(direct).sort(), [
      'action',
      'description',
      'expires_at',
      'granted',
      'id',
      'name',
      'resource',
      'source',
    ])
    assert.equal(direct.source, 'direct')
    assert.deepEqual(Object.keys(inherited).sort(), [
      'action',
      'description',
      'id',
      'name',
      'resource',
      'source',
    ])
    assert.equal(inherited.source, 'role')
  })

  test('GET /me/roles should return user roles', async ({ client, assert }) => {
    // Create user with multiple roles
    const user = await User.create({
      full_name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    })

    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user',
      }
    )
    const moderatorRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.MODERATOR },
      {
        name: 'Moderator',
        slug: IRole.Slugs.MODERATOR,
        description: 'Platform moderator',
      }
    )

    await user.related('roles').sync([userRole.id, moderatorRole.id])

    const response = await client.get('/api/v1/me/roles').loginAs(user)

    response.assertStatus(200)
    assertPrivateResponse(response)
    assert.equal(response.body().total, 2)
    assert.isArray(response.body().roles)
    assert.deepEqual(Object.keys(response.body()).sort(), ['roles', 'total'])

    const roleNames = response.body().roles.map((r: any) => r.name)
    assert.includeMembers(roleNames, ['User', 'Moderator'])
    for (const role of response.body().roles) {
      assert.deepEqual(Object.keys(role).sort(), [
        'assigned_at',
        'created_at',
        'description',
        'id',
        'name',
        'slug',
        'updated_at',
      ])
      assert.match(role.assigned_at, /^\d{4}-\d{2}-\d{2}T/)
    }
  })

  test('should return the canonical private JSON error for unauthenticated /me requests', async ({
    client,
    assert,
  }) => {
    const endpoints = ['/api/v1/me', '/api/v1/me/permissions', '/api/v1/me/roles']

    for (const endpoint of endpoints) {
      const response = await client.get(endpoint)
      response.assertStatus(401)
      response.assertBody({ errors: [{ message: 'Unauthorized access' }] })
      assert.match(String(response.header('content-type')), /^application\/json\b/)
      assertPrivateResponse(response)
    }
  })
})
