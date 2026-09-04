import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import Permission from '#modules/permissions/models/permission'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import PermissionService from '#modules/permissions/services/permission_service'
import Role from '#modules/roles/models/role'
import User from '#modules/users/models/user'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import IRole from '#modules/roles/interfaces/role_interface'

function emailAtDatabaseLimit(extraCharacters = 0): string {
  return `${'e'.repeat(64)}@${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(
    57 + extraCharacters
  )}.com`
}

test.group('Users CRUD', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function currentEpoch(cache: PermissionCacheService, userId: number): Promise<string> {
    const snapshot = await cache.getUserPermissionsSnapshot(userId)
    return snapshot.epoch
  }

  // Helper function to create and assign permissions to a role
  async function assignPermissions(role: Role, actions: string[]) {
    const permissions = await Promise.all(
      actions.map((action) =>
        Permission.firstOrCreate(
          {
            resource: IPermission.Resources.USERS,
            action: action,
          },
          {
            name: `users.${action}`,
            resource: IPermission.Resources.USERS,
            action: action,
          }
        )
      )
    )
    await role.related('permissions').sync(permissions.map((p) => p.id))
  }

  async function createAuthorizedUser(email: string, actions: string[]) {
    const role = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )
    const user = await User.create({
      full_name: 'Authorized User',
      email,
      password: 'password123',
    })

    await user.related('roles').attach([role.id])
    await assignPermissions(role, actions)
    return user
  }

  test('should get user by id', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: userRole.id,
    })

    // Assign read permission to user role
    await assignPermissions(userRole, [IPermission.Actions.READ])

    const targetUser = await User.create({
      full_name: 'Target User',
      email: 'target@example.com',
      username: 'targetuser',
      password: 'password123',
    })

    const response = await client.get(`/api/v1/users/${targetUser.id}`).loginAs(authUser)

    response.assertStatus(200)
    response.assertBodyContains({
      id: targetUser.id,
      email: targetUser.email,
      username: targetUser.username,
      full_name: targetUser.full_name,
    })
  })

  test('should return 404 for non-existent user', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: userRole.id,
    })

    // Assign read permission to user role
    await assignPermissions(userRole, [IPermission.Actions.READ])

    const response = await client.get('/api/v1/users/999999').loginAs(authUser)

    response.assertStatus(404)
    response.assertBodyContains({
      message: 'User not found',
    })
  })

  test('should create a new user with an optional blank username', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: userRole.id,
    })

    // Assign create permission to user role
    await assignPermissions(userRole, [IPermission.Actions.CREATE])

    const newUserData = {
      full_name: 'New User',
      email: 'newuser@example.com',
      username: '   ',
      password: 'password123',
      password_confirmation: 'password123',
    }

    const response = await client.post('/api/v1/users').json(newUserData).loginAs(authUser)

    response.assertStatus(201)
    response.assertBodyContains({
      email: newUserData.email,
      username: null,
      full_name: newUserData.full_name,
    })

    const createdUser = await User.findBy('email', newUserData.email)
    assert.isNotNull(createdUser)
    assert.isNull(createdUser!.username)
  })

  test('should validate user creation data', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: userRole.id,
    })

    // Assign create permission to user role
    await assignPermissions(userRole, [IPermission.Actions.CREATE])

    const response = await client
      .post('/api/v1/users')
      .header('Accept', 'application/json')
      .json({
        full_name: 'New User',
        email: 'invalid-email',
        username: 'nu', // too short
        password: '123', // too short
      })
      .loginAs(authUser)

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'email',
          rule: 'email',
        },
        {
          field: 'username',
          rule: 'minLength',
        },
        {
          field: 'password',
          rule: 'minLength',
        },
      ],
    })
  })

  test('should read administrative create and update fields only from the request body', async ({
    client,
    assert,
  }) => {
    const authUser = await createAuthorizedUser('body-only-auth@example.com', [
      IPermission.Actions.CREATE,
      IPermission.Actions.UPDATE,
    ])
    const queryPayload = {
      full_name: 'Query User',
      email: 'query-user@example.com',
      username: 'query-user',
      password: 'password123',
      password_confirmation: 'password123',
    }

    const queryOnlyCreate = await client
      .post('/api/v1/users')
      .header('Accept', 'application/json')
      .qs(queryPayload)
      .json({})
      .loginAs(authUser)

    queryOnlyCreate.assertStatus(422)
    queryOnlyCreate.assertBodyContains({
      errors: [
        { field: 'full_name', rule: 'required' },
        { field: 'email', rule: 'required' },
        { field: 'password', rule: 'required' },
      ],
    })
    assert.isNull(await User.findBy('email', queryPayload.email))

    const bodyPayload = {
      full_name: 'Body User',
      email: 'body-user@example.com',
      username: 'body-user',
      password: 'password123',
      password_confirmation: 'password123',
    }
    const bodyCreate = await client
      .post('/api/v1/users')
      .qs({ ...queryPayload, email: 'conflicting-query-user@example.com' })
      .json(bodyPayload)
      .loginAs(authUser)

    bodyCreate.assertStatus(201)
    bodyCreate.assertBodyContains({
      full_name: bodyPayload.full_name,
      email: bodyPayload.email,
      username: bodyPayload.username,
    })
    assert.isNull(await User.findBy('email', 'conflicting-query-user@example.com'))

    const targetUser = await User.findByOrFail('email', bodyPayload.email)
    const queryOnlyUpdate = await client
      .put(`/api/v1/users/${targetUser.id}`)
      .qs({ full_name: 'Query Update' })
      .json({})
      .loginAs(authUser)

    queryOnlyUpdate.assertStatus(200)
    await targetUser.refresh()
    assert.equal(targetUser.full_name, bodyPayload.full_name)

    const bodyUpdate = await client
      .put(`/api/v1/users/${targetUser.id}`)
      .qs({ full_name: 'Conflicting Query Update' })
      .json({ full_name: 'Body Update' })
      .loginAs(authUser)

    bodyUpdate.assertStatus(200)
    await targetUser.refresh()
    assert.equal(targetUser.full_name, 'Body Update')
  })

  test('should enforce the database field limits on administrative create and update', async ({
    client,
    assert,
  }) => {
    const authUser = await createAuthorizedUser('field-limits-auth@example.com', [
      IPermission.Actions.CREATE,
      IPermission.Actions.UPDATE,
    ])
    const maximumEmail = emailAtDatabaseLimit()
    const oversizedEmail = emailAtDatabaseLimit(1)
    assert.lengthOf(maximumEmail, 254)
    assert.lengthOf(oversizedEmail, 255)

    const acceptedCreate = await client
      .post('/api/v1/users')
      .json({
        full_name: 'N'.repeat(255),
        email: maximumEmail,
        username: 'u'.repeat(80),
        password: 'password123',
        password_confirmation: 'password123',
      })
      .loginAs(authUser)

    acceptedCreate.assertStatus(201)
    acceptedCreate.assertBodyContains({
      full_name: 'N'.repeat(255),
      email: maximumEmail,
      username: 'u'.repeat(80),
    })

    const rejectedCreate = await client
      .post('/api/v1/users')
      .header('Accept', 'application/json')
      .json({
        full_name: 'N'.repeat(256),
        email: oversizedEmail,
        username: 'v'.repeat(81),
        password: 'password123',
        password_confirmation: 'password123',
      })
      .loginAs(authUser)

    rejectedCreate.assertStatus(422)
    rejectedCreate.assertBodyContains({
      errors: [
        { field: 'full_name', rule: 'maxLength' },
        { field: 'email', rule: 'maxLength' },
        { field: 'username', rule: 'maxLength' },
      ],
    })

    const targetUser = await User.findByOrFail('email', maximumEmail)
    const acceptedUpdate = await client
      .put(`/api/v1/users/${targetUser.id}`)
      .json({ full_name: 'U'.repeat(255) })
      .loginAs(authUser)
    acceptedUpdate.assertStatus(200)

    const rejectedUpdate = await client
      .put(`/api/v1/users/${targetUser.id}`)
      .header('Accept', 'application/json')
      .json({ full_name: 'U'.repeat(256) })
      .loginAs(authUser)
    rejectedUpdate.assertStatus(422)
    rejectedUpdate.assertBodyContains({
      errors: [{ field: 'full_name', rule: 'maxLength' }],
    })

    await targetUser.refresh()
    assert.equal(targetUser.full_name, 'U'.repeat(255))
  })

  test('should enforce platform role hierarchy for administrative updates and deletes', async ({
    client,
    assert,
  }) => {
    const rootRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ROOT },
      { name: 'Root', slug: IRole.Slugs.ROOT, description: 'Root role' }
    )
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      { name: 'Admin', slug: IRole.Slugs.ADMIN, description: 'Administrator role' }
    )
    await assignPermissions(rootRole, [IPermission.Actions.UPDATE, IPermission.Actions.DELETE])
    await assignPermissions(adminRole, [IPermission.Actions.UPDATE, IPermission.Actions.DELETE])

    const root = await User.create({
      full_name: 'Protected Root',
      email: 'protected-root@example.com',
      username: 'protected-root',
      password: 'password123',
    })
    const admin = await User.create({
      full_name: 'Administrative Actor',
      email: 'administrative-actor@example.com',
      username: 'administrative-actor',
      password: 'password123',
    })
    const peerAdmin = await User.create({
      full_name: 'Peer Admin',
      email: 'peer-admin@example.com',
      username: 'peer-admin',
      password: 'password123',
    })
    await root.related('roles').attach([rootRole.id])
    await admin.related('roles').attach([adminRole.id])
    await peerAdmin.related('roles').attach([adminRole.id])

    const rootPasswordHash = root.password
    const forbiddenUpdate = await client
      .put(`/api/v1/users/${root.id}`)
      .json({ password: 'attacker-password123', password_confirmation: 'attacker-password123' })
      .loginAs(admin)
    forbiddenUpdate.assertStatus(403)
    forbiddenUpdate.assertBodyContains({
      message: 'You cannot manage a user with an equal or higher platform role',
    })
    forbiddenUpdate.assertHeader('cache-control', 'private, no-store')

    const permissionService = await app.container.make(PermissionService)
    const permissionCache = await app.container.make(PermissionCacheService)
    const warmedPermissions = await permissionService.getEffectivePermissions(root.id)
    assert.isAbove(warmedPermissions.length, 0)
    const epochBeforeForbiddenDelete = await currentEpoch(permissionCache, root.id)
    const forbiddenRootDelete = await client.delete(`/api/v1/users/${root.id}`).loginAs(admin)
    forbiddenRootDelete.assertStatus(403)
    assert.equal(await currentEpoch(permissionCache, root.id), epochBeforeForbiddenDelete)

    const forbiddenPeerDelete = await client.delete(`/api/v1/users/${peerAdmin.id}`).loginAs(admin)
    forbiddenPeerDelete.assertStatus(403)

    await root.refresh()
    await peerAdmin.refresh()
    assert.equal(root.password, rootPasswordHash)
    assert.isFalse(root.is_deleted)
    assert.isFalse(peerAdmin.is_deleted)

    const selfUpdate = await client
      .put(`/api/v1/users/${root.id}`)
      .json({ full_name: 'Updated Root Profile' })
      .loginAs(root)
    selfUpdate.assertStatus(200)

    const selfDelete = await client.delete(`/api/v1/users/${root.id}`).loginAs(root)
    selfDelete.assertStatus(403)
    selfDelete.assertBodyContains({
      message: 'Use the account deletion flow to delete your own account',
    })

    const allowedUpdate = await client
      .put(`/api/v1/users/${admin.id}`)
      .json({ password: 'root-reset-password123', password_confirmation: 'root-reset-password123' })
      .loginAs(root)
    allowedUpdate.assertStatus(200)
    const verifiedAdmin = await User.verifyCredentials(admin.email, 'root-reset-password123')
    assert.equal(verifiedAdmin.id, admin.id)

    const allowedDelete = await client.delete(`/api/v1/users/${peerAdmin.id}`).loginAs(root)
    allowedDelete.assertStatus(204)
    allowedDelete.assertHeader('cache-control', 'private, no-store')
    const deletedPeer = await db.from('users').where('id', peerAdmin.id).firstOrFail()
    assert.isTrue(deletedPeer.is_deleted)

    const peerRoot = await User.create({
      full_name: 'Peer Root',
      email: 'peer-root@example.com',
      username: 'peer-root',
      password: 'password123',
    })
    await peerRoot.related('roles').attach([rootRole.id])
    const peerRootDelete = await client.delete(`/api/v1/users/${peerRoot.id}`).loginAs(root)
    peerRootDelete.assertStatus(204)

    const activeRootRows = await db
      .from('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .where('user_roles.role_id', rootRole.id)
      .where('users.is_deleted', false)
    assert.lengthOf(activeRootRows, 1)
  })

  test('should return not found for missing administrative update and delete targets', async ({
    client,
  }) => {
    const rootRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ROOT },
      { name: 'Root', slug: IRole.Slugs.ROOT, description: 'Root role' }
    )
    await assignPermissions(rootRole, [IPermission.Actions.UPDATE, IPermission.Actions.DELETE])
    const root = await User.create({
      full_name: 'Missing Target Root',
      email: 'missing-target-root@example.com',
      username: 'missing-target-root',
      password: 'password123',
    })
    await root.related('roles').attach([rootRole.id])

    const update = await client
      .put('/api/v1/users/2147483647')
      .json({ full_name: 'Nobody' })
      .loginAs(root)
    update.assertStatus(404)
    update.assertBodyContains({ status: 404, message: 'User not found' })

    const deletion = await client.delete('/api/v1/users/2147483647').loginAs(root)
    deletion.assertStatus(404)
    deletion.assertBodyContains({ status: 404, message: 'User not found' })

    const overflow = await client
      .put('/api/v1/users/2147483648')
      .json({ full_name: 'Overflow' })
      .loginAs(root)
    overflow.assertStatus(422)
  })

  test('should update user', async ({ client, assert }) => {
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: adminRole.id,
    })

    await assignPermissions(adminRole, [IPermission.Actions.UPDATE])

    const targetUser = await User.create({
      full_name: 'Old Name',
      email: 'olduser@example.com',
      username: 'olduser',
      password: 'password123',
    })
    await targetUser.related('roles').attach([userRole.id])

    const updateData = {
      full_name: 'Updated Name',
    }

    const response = await client
      .put(`/api/v1/users/${targetUser.id}`)
      .json(updateData)
      .loginAs(authUser)

    response.assertStatus(200)
    response.assertBodyContains({
      id: targetUser.id,
      full_name: updateData.full_name,
      email: targetUser.email,
      username: targetUser.username,
    })

    await targetUser.refresh()
    assert.equal(targetUser.full_name, updateData.full_name)

    const authorizationAudit = await db
      .from('audit_logs')
      .where('user_id', authUser.id)
      .where('resource', IPermission.Resources.USERS)
      .where('action', IPermission.Actions.UPDATE)
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.equal(authorizationAudit.resource_id, targetUser.id)
  })

  test('should not update email or username', async ({ client, assert }) => {
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: adminRole.id,
    })

    await assignPermissions(adminRole, [IPermission.Actions.UPDATE])

    const originalEmail = 'original@example.com'
    const originalUsername = 'originaluser'

    const targetUser = await User.create({
      full_name: 'Target User',
      email: originalEmail,
      username: originalUsername,
      password: 'password123',
    })
    await targetUser.related('roles').attach([userRole.id])

    const response = await client
      .put(`/api/v1/users/${targetUser.id}`)
      .json({
        email: 'newemail@example.com',
        username: 'newusername',
        full_name: 'Updated User',
      })
      .loginAs(authUser)

    response.assertStatus(200)

    await targetUser.refresh()
    assert.equal(targetUser.email, originalEmail)
    assert.equal(targetUser.username, originalUsername)
    assert.equal(targetUser.full_name, 'Updated User')
  })

  test('should delete user (soft delete)', async ({ client, assert }) => {
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: adminRole.id,
    })

    await assignPermissions(adminRole, [IPermission.Actions.DELETE])

    const targetUser = await User.create({
      full_name: 'Delete Me',
      email: 'deleteme@example.com',
      username: 'deleteme',
      password: 'password123',
    })
    await targetUser.related('roles').attach([userRole.id])
    const permissionService = await app.container.make(PermissionService)
    const permissionCache = await app.container.make(PermissionCacheService)
    const warmedPermissions = await permissionService.getEffectivePermissions(targetUser.id)
    assert.isAbove(warmedPermissions.length, 0)
    const epochBefore = await currentEpoch(permissionCache, targetUser.id)

    const response = await client.delete(`/api/v1/users/${targetUser.id}`).loginAs(authUser)

    response.assertStatus(204)
    const epochAfter = await currentEpoch(permissionCache, targetUser.id)
    assert.equal(BigInt(epochAfter), BigInt(epochBefore) + 1n)
    assert.deepEqual(await permissionService.getEffectivePermissions(targetUser.id), [])

    // Check if soft deleted
    const deletedUser = await db.from('users').where('id', targetUser.id).first()
    assert.isNotNull(deletedUser)
    // SQLite returns 0/1 for booleans, so we need to check for truthy value
    assert.isTrue(!!deletedUser!.is_deleted)

    // Check if not found with normal query due to soft delete scope
    const notFoundUser = await User.find(targetUser.id)
    assert.isNull(notFoundUser)
  })

  test('should require authentication for all operations', async ({ client }) => {
    const responses = await Promise.all([
      client.get('/api/v1/users'),
      client.get('/api/v1/users/1'),
      client.post('/api/v1/users').json({}),
      client.put('/api/v1/users/1').json({}),
      client.delete('/api/v1/users/1'),
    ])

    responses.forEach((response) => {
      response.assertStatus(401)
    })
  })
})
