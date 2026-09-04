import { test } from '@japa/runner'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type CreateDefaultPermissionsService from '#modules/permissions/services/create_default_permissions_service'
import type PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import AssignDefaultPermissionsService from '#modules/permissions/services/assign_default_permissions_service'
import type SyncRolePermissionsService from '#modules/permissions/services/sync_role_permissions_service'
import type PermissionRepository from '#modules/permissions/repositories/permission_repository'
import type RolesRepository from '#modules/roles/repositories/roles_repository'

class TransactionHarness extends AssignDefaultPermissionsService {
  transactionRuns = 0
  committed = false

  constructor(
    createDefaultPermissionsService: CreateDefaultPermissionsService,
    syncRolePermissionsService: SyncRolePermissionsService,
    rolesRepository: RolesRepository,
    permissionRepository: PermissionRepository,
    permissionCacheService: PermissionCacheService,
    private client: TransactionClientContract
  ) {
    super(
      createDefaultPermissionsService,
      syncRolePermissionsService,
      rolesRepository,
      permissionRepository,
      permissionCacheService
    )
  }

  protected async withTransaction<T>(
    callback: (client: TransactionClientContract) => Promise<T>
  ): Promise<T> {
    this.transactionRuns++
    const result = await callback(this.client)
    this.committed = true
    return result
  }
}

test.group('AssignDefaultPermissionsService', () => {
  test('bumps the ACL epoch once after a committed sync even when no roles exist', async ({
    assert,
  }) => {
    const client = {} as TransactionClientContract
    let createRuns = 0
    let roleLookups = 0
    let roleSyncs = 0
    let epochBumps = 0

    const service = new TransactionHarness(
      {
        async run(receivedClient: TransactionClientContract) {
          assert.strictEqual(receivedClient, client)
          createRuns++
        },
      } as unknown as CreateDefaultPermissionsService,
      {
        async syncSystemPermissions() {
          roleSyncs++
        },
      } as unknown as SyncRolePermissionsService,
      {
        async findBy(
          _column: string,
          _value: unknown,
          options?: { client?: TransactionClientContract }
        ) {
          assert.strictEqual(options?.client, client)
          roleLookups++
          return null
        },
      } as unknown as RolesRepository,
      {} as unknown as PermissionRepository,
      {
        async bumpEpochAfterCommittedMutation() {
          epochBumps++
        },
      } as unknown as PermissionCacheService,
      client
    )

    await service.run()

    assert.equal(service.transactionRuns, 1)
    assert.isTrue(service.committed)
    assert.equal(createRuns, 1)
    assert.equal(roleLookups, 5)
    assert.equal(roleSyncs, 0)
    assert.equal(epochBumps, 1)
  })

  test('does not bump the ACL epoch when the permission sync rolls back', async ({ assert }) => {
    const client = {} as TransactionClientContract
    let epochBumps = 0
    const service = new TransactionHarness(
      {
        async run() {
          throw new Error('Permission sync failed')
        },
      } as unknown as CreateDefaultPermissionsService,
      {} as unknown as SyncRolePermissionsService,
      {} as unknown as RolesRepository,
      {} as unknown as PermissionRepository,
      {
        async bumpEpochAfterCommittedMutation() {
          epochBumps++
        },
      } as unknown as PermissionCacheService,
      client
    )

    await assert.rejects(() => service.run(), 'Permission sync failed')

    assert.equal(service.transactionRuns, 1)
    assert.isFalse(service.committed)
    assert.equal(epochBumps, 0)
  })
})
