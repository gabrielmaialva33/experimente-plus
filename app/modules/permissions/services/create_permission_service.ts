import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import { POSTGRES_INTEGER_MAX } from '#modules/permissions/permission_limits'
import type Permission from '#modules/permissions/models/permission'
import { canonicalPermissionName } from '#modules/permissions/permission_name'
import { mapPermissionNameUniqueConstraintError } from '#modules/permissions/permission_unique_constraint_error'
import PermissionRepository from '#modules/permissions/repositories/permission_repository'
import PermissionAdministrationPolicyService from '#modules/permissions/services/permission_administration_policy_service'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'

type CreatePermissionRequest = {
  actorUserId: number
  data: IPermission.PermissionData
}

@inject()
export default class CreatePermissionService {
  constructor(
    private permissionCacheService: PermissionCacheService,
    private permissionAdministrationPolicyService: PermissionAdministrationPolicyService,
    private permissionRepository: PermissionRepository
  ) {}

  async handle({ actorUserId, data }: CreatePermissionRequest): Promise<Permission> {
    if (!Number.isInteger(actorUserId) || actorUserId < 1 || actorUserId > POSTGRES_INTEGER_MAX) {
      throw new BadRequestException('Actor id must be a positive int4 value')
    }

    let permission: Permission
    try {
      permission = await db.transaction(async (client) => {
        await this.permissionAdministrationPolicyService.lockAndAuthorizePermissionCreation(
          actorUserId,
          client
        )

        return this.upsertPermission(data, client)
      })
    } catch (error) {
      throw mapPermissionNameUniqueConstraintError(error)
    }

    await this.permissionCacheService.clearAllCache()
    return permission
  }

  private async upsertPermission(
    data: IPermission.PermissionData,
    client: TransactionClientContract
  ): Promise<Permission> {
    const context = data.context ?? IPermission.Contexts.ANY
    const name = canonicalPermissionName(data.resource, data.action, context)

    return this.permissionRepository.upsertCanonical(
      {
        name,
        description: data.description,
        resource: data.resource,
        action: data.action,
        context,
      },
      client
    )
  }
}
