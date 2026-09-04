import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import Permission from '#modules/permissions/models/permission'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import PermissionService from '#modules/permissions/services/permission_service'
import SyncRolePermissionsService from '#modules/permissions/services/sync_role_permissions_service'
import SyncUserPermissionsService from '#modules/permissions/services/sync_user_permissions_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import SyncRolesService from '#modules/roles/services/sync_roles_service'
import User from '#modules/users/models/user'

test.group('Permission cache invalidation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function currentEpoch(cache: PermissionCacheService, userId: number): Promise<string> {
    const snapshot = await cache.getUserPermissionsSnapshot(userId)
    return snapshot.epoch
  }

  async function usersReadPermission() {
    return Permission.query()
      .where('resource', IPermission.Resources.USERS)
      .where('action', IPermission.Actions.READ)
      .where('context', IPermission.Contexts.ANY)
      .firstOrFail()
  }

  async function rootActor(suffix: string) {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const actor = await User.create({
      full_name: 'Permission Cache Root',
      email: `permission-cache-root-${suffix}@example.com`,
      username: `permission-cache-root-${suffix}`,
      password: 'password123',
    })
    await actor.related('roles').attach([rootRole.id])
    return actor
  }

  async function limitedUser(permissionId: number) {
    const user = await User.create({
      full_name: 'Cached User',
      email: 'cached-user@example.com',
      username: 'cached-user',
      password: 'password123',
    })
    const limitedRole = await Role.findByOrFail('slug', IRole.Slugs.GUEST)
    await limitedRole.related('permissions').detach([permissionId])
    await user.related('roles').sync([limitedRole.id])
    return { user, limitedRole }
  }

  test('should invalidate user caches after role permissions change', async ({ assert }) => {
    const permission = await usersReadPermission()
    const actor = await rootActor('role')
    const { user, limitedRole } = await limitedUser(permission.id)
    const permissionService = await app.container.make(PermissionService)
    const syncRolePermissions = await app.container.make(SyncRolePermissionsService)

    assert.isFalse(
      await permissionService.checkUserPermission({
        user_id: user.id,
        permission: permission.name,
      })
    )
    const permissionCache = await app.container.make(PermissionCacheService)
    const epochBefore = await currentEpoch(permissionCache, user.id)

    await syncRolePermissions.attachPermissions({
      actorUserId: actor.id,
      roleId: limitedRole.id,
      permissionIds: [permission.id],
    })
    const epochAfter = await currentEpoch(permissionCache, user.id)
    assert.equal(BigInt(epochAfter), BigInt(epochBefore) + 1n)

    assert.isTrue(
      await permissionService.checkUserPermission({
        user_id: user.id,
        permission: permission.name,
      })
    )
  })

  test('should invalidate user caches after a role is attached', async ({ assert }) => {
    const permission = await usersReadPermission()
    const guestRole = await Role.findByOrFail('slug', IRole.Slugs.GUEST)
    const readerRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    const user = await User.create({
      full_name: 'Guest Cache User',
      email: 'guest-cache-user@example.com',
      username: 'guest-cache-user',
      password: 'password123',
    })
    await user.related('roles').sync([guestRole.id])
    await readerRole.related('permissions').sync([permission.id])

    const permissionService = await app.container.make(PermissionService)
    const syncRoles = await app.container.make(SyncRolesService)
    const rootRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ROOT },
      { name: 'Root', slug: IRole.Slugs.ROOT, description: 'Root administrator role' }
    )
    const actor = await User.create({
      full_name: 'Role Assignment Root',
      email: 'role-assignment-root@example.com',
      username: 'role-assignment-root',
      password: 'password123',
    })
    await actor.related('roles').attach([rootRole.id])

    assert.isFalse(
      await permissionService.checkUserPermission({
        user_id: user.id,
        permission: permission.name,
      })
    )
    const permissionCache = await app.container.make(PermissionCacheService)
    const epochBefore = await currentEpoch(permissionCache, user.id)

    await syncRoles.run({ actorUserId: actor.id, userId: user.id, roleIds: [readerRole.id] })
    const epochAfter = await currentEpoch(permissionCache, user.id)
    assert.equal(BigInt(epochAfter), BigInt(epochBefore) + 1n)

    assert.isTrue(
      await permissionService.checkUserPermission({
        user_id: user.id,
        permission: permission.name,
      })
    )
  })

  test('should invalidate user caches after a direct permission is attached', async ({
    assert,
  }) => {
    const permission = await usersReadPermission()
    const actor = await rootActor('direct')
    const { user } = await limitedUser(permission.id)
    const permissionService = await app.container.make(PermissionService)
    const syncUserPermissions = await app.container.make(SyncUserPermissionsService)

    assert.isFalse(
      await permissionService.checkUserPermission({
        user_id: user.id,
        permission: permission.name,
      })
    )
    const permissionCache = await app.container.make(PermissionCacheService)
    const epochBefore = await currentEpoch(permissionCache, user.id)

    await syncUserPermissions.attachPermission({
      actorUserId: actor.id,
      userId: user.id,
      permissionId: permission.id,
    })
    const epochAfter = await currentEpoch(permissionCache, user.id)
    assert.equal(BigInt(epochAfter), BigInt(epochBefore) + 1n)

    assert.isTrue(
      await permissionService.checkUserPermission({
        user_id: user.id,
        permission: permission.name,
      })
    )
  })

  test('does not bump the epoch when an ACL transaction rolls back', async ({ assert }) => {
    const permission = await usersReadPermission()
    const actor = await rootActor('rollback')
    const { user } = await limitedUser(permission.id)
    const permissionCache = await app.container.make(PermissionCacheService)
    const syncUserPermissions = await app.container.make(SyncUserPermissionsService)
    const epochBefore = await currentEpoch(permissionCache, user.id)

    await assert.rejects(
      () =>
        syncUserPermissions.attachPermission({
          actorUserId: actor.id,
          userId: user.id,
          permissionId: 2_147_483_647,
        }),
      'Permission not found'
    )

    const epochAfter = await currentEpoch(permissionCache, user.id)
    assert.equal(epochAfter, epochBefore)
  })
})
