import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import ForbiddenException from '#exceptions/forbidden_exception'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import PermissionRepository from '#modules/permissions/repositories/permission_repository'
import IRole from '#modules/roles/interfaces/role_interface'

type PlatformCapability = {
  resource: IPermission.Resources
  action: IPermission.Actions
  context?: IPermission.Contexts
}

/**
 * Rechecks a privileged capability from PostgreSQL while the caller holds the
 * active actor user row and every actor role row. Redis is deliberately not
 * consulted at this final write boundary.
 */
@inject()
export default class FreshPlatformPermissionService {
  constructor(private permissionRepository: PermissionRepository) {}

  async assertGranted(
    actorUserId: number,
    actorRoles: readonly string[],
    capability: PlatformCapability,
    client: TransactionClientContract
  ): Promise<void> {
    if (!IRole.isPlatformAdministrator(actorRoles)) {
      throw new ForbiddenException('The acting user is no longer a platform administrator')
    }

    const context = capability.context ?? IPermission.Contexts.ANY
    const grant = { resource: capability.resource, action: capability.action, context }

    if (await this.permissionRepository.hasDirectGrant(actorUserId, grant, client)) {
      return
    }

    const effectiveRoleSlugs = [
      ...new Set(
        actorRoles.flatMap((role) =>
          IRole.isCanonicalSlug(role) ? [role, ...IRole.ROLE_HIERARCHY[role]] : []
        )
      ),
    ]

    if (!(await this.permissionRepository.hasRoleGrant(effectiveRoleSlugs, grant, client))) {
      throw new ForbiddenException(
        'The acting user no longer has permission to perform this action'
      )
    }
  }
}
