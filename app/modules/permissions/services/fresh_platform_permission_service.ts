import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import ForbiddenException from '#exceptions/forbidden_exception'
import IPermission from '#modules/permissions/interfaces/permission_interface'
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
export default class FreshPlatformPermissionService {
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
    const directPermission = await client
      .from('user_permissions as user_permission')
      .innerJoin('permissions as permission', 'permission.id', 'user_permission.permission_id')
      .where('user_permission.user_id', actorUserId)
      .where('user_permission.granted', true)
      .where((query) => {
        query
          .whereNull('user_permission.expires_at')
          .orWhere('user_permission.expires_at', '>', client.raw('CURRENT_TIMESTAMP'))
      })
      .where('permission.resource', capability.resource)
      .where('permission.action', capability.action)
      .where('permission.context', context)
      .select('permission.id')
      .first()

    if (directPermission) {
      return
    }

    const effectiveRoleSlugs = [
      ...new Set(
        actorRoles.flatMap((role) =>
          IRole.isCanonicalSlug(role) ? [role, ...IRole.ROLE_HIERARCHY[role]] : []
        )
      ),
    ]
    const rolePermission = await client
      .from('role_permissions as role_permission')
      .innerJoin('roles as role', 'role.id', 'role_permission.role_id')
      .innerJoin('permissions as permission', 'permission.id', 'role_permission.permission_id')
      .whereIn('role.slug', effectiveRoleSlugs)
      .where('permission.resource', capability.resource)
      .where('permission.action', capability.action)
      .where('permission.context', context)
      .select('permission.id')
      .first()

    if (!rolePermission) {
      throw new ForbiddenException(
        'The acting user no longer has permission to perform this action'
      )
    }
  }
}
