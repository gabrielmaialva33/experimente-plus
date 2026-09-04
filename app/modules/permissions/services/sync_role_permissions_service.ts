import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import {
  PERMISSION_MUTATION_MAX_ITEMS,
  POSTGRES_INTEGER_MAX,
} from '#modules/permissions/permission_limits'
import Permission from '#modules/permissions/models/permission'
import PermissionAdministrationPolicyService from '#modules/permissions/services/permission_administration_policy_service'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import Role from '#modules/roles/models/role'
import RolesRepository from '#modules/roles/repositories/roles_repository'

type RolePermissionMutation = {
  actorUserId: number
  roleId: number
  permissionIds: number[]
}

type MutationKind = 'sync' | 'attach' | 'detach'

@inject()
export default class SyncRolePermissionsService {
  constructor(
    private rolesRepository: RolesRepository,
    private permissionCacheService: PermissionCacheService,
    private permissionAdministrationPolicyService: PermissionAdministrationPolicyService
  ) {}

  async handle(input: RolePermissionMutation): Promise<void> {
    await this.mutate('sync', input)
  }

  async attachPermissions(input: RolePermissionMutation): Promise<void> {
    await this.mutate('attach', input)
  }

  async detachPermissions(input: RolePermissionMutation): Promise<void> {
    await this.mutate('detach', input)
  }

  /**
   * Trusted bootstrap path used by the permission synchronization command.
   * Runtime HTTP mutations must use the actor-aware methods above.
   */
  async syncSystemPermissions(
    roleId: number,
    permissionIds: number[],
    trx?: TransactionClientContract
  ): Promise<void> {
    const role = await this.findRoleOrFail(roleId, trx)
    await this.rolesRepository.syncPermissions(role, permissionIds, trx)

    if (!trx) {
      await this.invalidateCaches(roleId)
    }
  }

  private async mutate(kind: MutationKind, input: RolePermissionMutation): Promise<void> {
    this.assertMutationInput(input)

    await db.transaction(async (client) => {
      const role = await this.permissionAdministrationPolicyService.lockAndAuthorizeRoleMutation(
        input.actorUserId,
        input.roleId,
        client
      )
      await this.assertPermissionsExist(input.permissionIds, client)

      if (kind === 'sync') {
        await this.rolesRepository.syncPermissions(role, input.permissionIds, client)
      } else if (kind === 'attach') {
        await this.rolesRepository.attachPermissions(role, input.permissionIds, client)
      } else {
        await this.rolesRepository.detachPermissions(role, input.permissionIds, client)
      }
    })

    await this.invalidateCaches(input.roleId)
  }

  private assertMutationInput(input: RolePermissionMutation): void {
    if (!this.isPostgresId(input.actorUserId) || !this.isPostgresId(input.roleId)) {
      throw new BadRequestException('Actor and role ids must be positive int4 values')
    }
    if (input.permissionIds.length > PERMISSION_MUTATION_MAX_ITEMS) {
      throw new BadRequestException(
        `No more than ${PERMISSION_MUTATION_MAX_ITEMS} permissions may be changed at once`
      )
    }
    if (
      input.permissionIds.some((permissionId) => !this.isPostgresId(permissionId)) ||
      new Set(input.permissionIds).size !== input.permissionIds.length
    ) {
      throw new BadRequestException('Permission ids must be distinct positive int4 values')
    }
  }

  private async assertPermissionsExist(
    permissionIds: number[],
    client: TransactionClientContract
  ): Promise<void> {
    if (permissionIds.length === 0) {
      return
    }

    const rows = await Permission.query({ client })
      .whereIn('id', permissionIds)
      .orderBy('id', 'asc')
      .select('id')

    if (rows.length !== permissionIds.length) {
      throw new NotFoundException('Permission not found')
    }
  }

  private async findRoleOrFail(roleId: number, trx?: TransactionClientContract): Promise<Role> {
    const role = await this.rolesRepository.findBy('id', roleId, { client: trx })
    if (!role) {
      throw new NotFoundException('Role not found')
    }

    return role
  }

  private async invalidateCaches(_roleId: number): Promise<void> {
    await this.permissionCacheService.bumpEpochAfterCommittedMutation()
  }

  private isPostgresId(value: number): boolean {
    return Number.isInteger(value) && value >= 1 && value <= POSTGRES_INTEGER_MAX
  }
}
