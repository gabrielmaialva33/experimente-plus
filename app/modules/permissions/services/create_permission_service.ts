import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import { POSTGRES_INTEGER_MAX } from '#modules/permissions/permission_limits'
import Permission from '#modules/permissions/models/permission'
import { canonicalPermissionName } from '#modules/permissions/permission_name'
import { mapPermissionNameUniqueConstraintError } from '#modules/permissions/permission_unique_constraint_error'
import PermissionAdministrationPolicyService from '#modules/permissions/services/permission_administration_policy_service'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'

type CreatePermissionRequest = {
  actorUserId: number
  data: IPermission.PermissionData
}

const PERMISSION_NAME_LOCK_NAMESPACE = -0x5045524d // "PERM"; negative avoids tenant-id lock namespaces.

@inject()
export default class CreatePermissionService {
  constructor(
    private permissionCacheService: PermissionCacheService,
    private permissionAdministrationPolicyService: PermissionAdministrationPolicyService
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
    const now = new Date()
    const updateData: Record<string, unknown> = {
      name,
      updated_at: now,
    }

    if (data.description !== undefined) {
      updateData.description = data.description
    }

    // The table also has a unique name index. Serializing by the derived name
    // keeps two different administrator roles from racing across the two
    // uniqueness constraints before PostgreSQL reaches the tuple arbiter.
    await client.rawQuery('SELECT pg_advisory_xact_lock(CAST(? AS integer), hashtext(?))', [
      PERMISSION_NAME_LOCK_NAMESPACE,
      name,
    ])

    const [row] = await client
      .table('permissions')
      .insert({
        name,
        description: data.description ?? null,
        resource: data.resource,
        action: data.action,
        context,
        created_at: now,
        updated_at: now,
      })
      .onConflict(['resource', 'action', 'context'])
      .merge(updateData)
      .returning('id')

    return Permission.query({ client }).where('id', Number(row.id)).firstOrFail()
  }
}
