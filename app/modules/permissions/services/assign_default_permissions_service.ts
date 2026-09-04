import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

import CreateDefaultPermissionsService from '#modules/permissions/services/create_default_permissions_service'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import SyncRolePermissionsService from '#modules/permissions/services/sync_role_permissions_service'
import RolesRepository from '#modules/roles/repositories/roles_repository'
import PermissionRepository from '#modules/permissions/repositories/permission_repository'

import IRole from '#modules/roles/interfaces/role_interface'

@inject()
export default class AssignDefaultPermissionsService {
  constructor(
    private createDefaultPermissionsService: CreateDefaultPermissionsService,
    private syncRolePermissionsService: SyncRolePermissionsService,
    private rolesRepository: RolesRepository,
    private permissionRepository: PermissionRepository,
    private permissionCacheService: PermissionCacheService
  ) {}

  async run(): Promise<void> {
    await this.withTransaction(async (client) => {
      await this.syncWithinTransaction(client)
    })
    await this.permissionCacheService.bumpEpochAfterCommittedMutation()
  }

  protected async withTransaction<T>(
    callback: (client: TransactionClientContract) => Promise<T>
  ): Promise<T> {
    return db.transaction(callback)
  }

  private async syncWithinTransaction(trx: TransactionClientContract): Promise<void> {
    // First, create all default permissions
    await this.createDefaultPermissionsService.run(trx)

    // Then assign permissions to roles
    await this.assignPermissionsToRoles(trx)
  }

  private async assignPermissionsToRoles(trx?: TransactionClientContract): Promise<void> {
    // ROOT - All permissions
    await this.assignRootPermissions(trx)

    // ADMIN - All except permission management
    await this.assignAdminPermissions(trx)

    // MODERATOR - Organization and claim review permissions
    await this.assignModeratorPermissions(trx)

    // USER - Basic permissions
    await this.assignUserPermissions(trx)

    // GUEST - Read only
    await this.assignGuestPermissions(trx)
  }

  private async assignRootPermissions(trx?: TransactionClientContract): Promise<void> {
    const rootRole = await this.rolesRepository.findBy('slug', IRole.Slugs.ROOT, { client: trx })
    if (rootRole) {
      const permissionIds = await this.permissionRepository.findAllIds(trx)
      await this.syncRolePermissionsService.syncSystemPermissions(rootRole.id, permissionIds, trx)
    }
  }

  private async assignAdminPermissions(trx?: TransactionClientContract): Promise<void> {
    const adminRole = await this.rolesRepository.findBy('slug', IRole.Slugs.ADMIN, { client: trx })
    if (adminRole) {
      const permissionIds = await this.permissionRepository.findAdminPermissionIds(trx)
      await this.syncRolePermissionsService.syncSystemPermissions(adminRole.id, permissionIds, trx)
    }
  }

  private async assignModeratorPermissions(trx?: TransactionClientContract): Promise<void> {
    const moderatorRole = await this.rolesRepository.findBy('slug', IRole.Slugs.MODERATOR, {
      client: trx,
    })
    if (moderatorRole) {
      const permissionIds = await this.permissionRepository.findModeratorPermissionIds(trx)
      await this.syncRolePermissionsService.syncSystemPermissions(
        moderatorRole.id,
        permissionIds,
        trx
      )
    }
  }

  private async assignUserPermissions(trx?: TransactionClientContract): Promise<void> {
    const userRole = await this.rolesRepository.findBy('slug', IRole.Slugs.USER, { client: trx })
    if (userRole) {
      const permissionIds = await this.permissionRepository.findUserPermissionIds(trx)
      await this.syncRolePermissionsService.syncSystemPermissions(userRole.id, permissionIds, trx)
    }
  }

  private async assignGuestPermissions(trx?: TransactionClientContract): Promise<void> {
    const guestRole = await this.rolesRepository.findBy('slug', IRole.Slugs.GUEST, { client: trx })
    if (guestRole) {
      const permissionIds = await this.permissionRepository.findGuestPermissionIds(trx)
      await this.syncRolePermissionsService.syncSystemPermissions(guestRole.id, permissionIds, trx)
    }
  }
}
