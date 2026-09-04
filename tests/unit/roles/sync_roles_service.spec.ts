import { test } from '@japa/runner'

import type FreshPlatformPermissionService from '#modules/permissions/services/fresh_platform_permission_service'
import type PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import SyncRolesService from '#modules/roles/services/sync_roles_service'
import type UsersRepository from '#modules/users/repositories/users_repository'
import type UserAdministrationPolicyService from '#modules/users/services/user_administration_policy_service'

function serviceWithoutDatabase(): SyncRolesService {
  return new SyncRolesService(
    {} as UsersRepository,
    {} as PermissionCacheService,
    {} as UserAdministrationPolicyService,
    {} as FreshPlatformPermissionService
  )
}

test.group('SyncRolesService input boundary', () => {
  test('rejects invalid internal call-site ids, duplicates and collection sizes', async ({
    assert,
  }) => {
    const service = serviceWithoutDatabase()

    await assert.rejects(
      () => service.run({ actorUserId: 0, userId: 1, roleIds: [1] }),
      'Actor and user ids must be positive int4 values'
    )
    await assert.rejects(
      () => service.run({ actorUserId: 1, userId: 2_147_483_648, roleIds: [1] }),
      'Actor and user ids must be positive int4 values'
    )
    await assert.rejects(
      () => service.run({ actorUserId: 1, userId: 2, roleIds: [] }),
      'Between 1 and 5 roles must be provided'
    )
    await assert.rejects(
      () => service.run({ actorUserId: 1, userId: 2, roleIds: [1, 2, 3, 4, 5, 6] }),
      'Between 1 and 5 roles must be provided'
    )
    await assert.rejects(
      () => service.run({ actorUserId: 1, userId: 2, roleIds: [1, 1] }),
      'Role ids must be distinct positive int4 values'
    )
    await assert.rejects(
      () => service.run({ actorUserId: 1, userId: 2, roleIds: [1.5] }),
      'Role ids must be distinct positive int4 values'
    )
  })
})
