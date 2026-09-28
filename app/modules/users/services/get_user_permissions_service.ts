import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

import PermissionRepository from '#modules/permissions/repositories/permission_repository'
import UsersRepository from '#modules/users/repositories/users_repository'
import NotFoundException from '#exceptions/not_found_exception'

@inject()
export default class GetUserPermissionsService {
  constructor(
    private usersRepository: UsersRepository,
    private permissionRepository: PermissionRepository
  ) {}

  async run(userId: number) {
    const { i18n } = HttpContext.getOrFail()

    const user = await this.usersRepository.findBy('id', userId)
    if (!user) {
      throw new NotFoundException(
        i18n.t('errors.not_found', {
          resource: i18n.t('models.user'),
        })
      )
    }

    // Get direct user permissions
    const directPermissions = await this.permissionRepository.listGrantedDirectForUser(userId)

    // Get permissions through roles
    const rolePermissions = await this.permissionRepository.listThroughRolesForUser(userId)

    // Combine permissions (remove duplicates)
    const permissionMap = new Map()

    // Add role permissions first
    rolePermissions.forEach((perm) => {
      permissionMap.set(perm.id, {
        id: perm.id,
        name: perm.name,
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
        source: 'role',
      })
    })

    // Add direct permissions (they override role permissions)
    directPermissions.forEach((perm) => {
      permissionMap.set(perm.id, {
        id: perm.id,
        name: perm.name,
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
        expires_at: perm.expires_at,
        granted: perm.granted,
        source: 'direct',
      })
    })

    // Group permissions by resource
    const groupedPermissions: Record<string, any[]> = {}

    Array.from(permissionMap.values()).forEach((permission) => {
      if (!groupedPermissions[permission.resource]) {
        groupedPermissions[permission.resource] = []
      }
      groupedPermissions[permission.resource].push(permission)
    })

    return {
      total: permissionMap.size,
      permissions: Array.from(permissionMap.values()),
      grouped: groupedPermissions,
    }
  }
}
