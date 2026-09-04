import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import {
  checkUserPermissionsValidator,
  createPermissionValidator,
  listPermissionsValidator,
  permissionUserIdParamValidator,
  syncRolePermissionsValidator,
  syncUserPermissionsValidator,
} from '#modules/permissions/validators/permission_validators'

import ListPermissionsService from '#modules/permissions/services/list_permissions_service'
import CreatePermissionService from '#modules/permissions/services/create_permission_service'
import SyncRolePermissionsService from '#modules/permissions/services/sync_role_permissions_service'
import SyncUserPermissionsService from '#modules/permissions/services/sync_user_permissions_service'
import CheckUserPermissionService from '#modules/permissions/services/check_user_permission_service'

export default class PermissionsController {
  /**
   * List all permissions with pagination
   */
  async list({ request }: HttpContext) {
    const {
      page = 1,
      per_page: perPage = 10,
      resource,
      action,
    } = await request.validateUsing(listPermissionsValidator, { data: request.qs() })

    const service = await app.container.make(ListPermissionsService)
    return await service.handle(page, perPage, resource, action)
  }

  /**
   * Create a new permission
   */
  async create({ auth, request, response }: HttpContext) {
    const data = await request.validateUsing(createPermissionValidator, { data: request.body() })

    const service = await app.container.make(CreatePermissionService)
    const permission = await service.handle({ actorUserId: auth.getUserOrFail().id, data })

    return response.status(201).json(permission)
  }

  /**
   * Sync permissions for a role
   */
  async syncRolePermissions({ auth, request, response }: HttpContext) {
    const { role_id: roleId, permission_ids: permissionIds } = await request.validateUsing(
      syncRolePermissionsValidator,
      { data: request.body() }
    )

    const service = await app.container.make(SyncRolePermissionsService)
    await service.handle({
      actorUserId: auth.getUserOrFail().id,
      roleId,
      permissionIds,
    })

    return response.json({ message: 'Permissions synced successfully' })
  }

  /**
   * Attach permissions to a role (without removing existing ones)
   */
  async attachRolePermissions({ auth, request, response }: HttpContext) {
    const { role_id: roleId, permission_ids: permissionIds } = await request.validateUsing(
      syncRolePermissionsValidator,
      { data: request.body() }
    )

    const service = await app.container.make(SyncRolePermissionsService)
    await service.attachPermissions({
      actorUserId: auth.getUserOrFail().id,
      roleId,
      permissionIds,
    })

    return response.json({ message: 'Permissions attached successfully' })
  }

  /**
   * Detach permissions from a role
   */
  async detachRolePermissions({ auth, request, response }: HttpContext) {
    const { role_id: roleId, permission_ids: permissionIds } = await request.validateUsing(
      syncRolePermissionsValidator,
      { data: request.body() }
    )

    const service = await app.container.make(SyncRolePermissionsService)
    await service.detachPermissions({
      actorUserId: auth.getUserOrFail().id,
      roleId,
      permissionIds,
    })

    return response.json({ message: 'Permissions detached successfully' })
  }

  /**
   * Sync permissions for a user
   */
  async syncUserPermissions({ auth, request, response }: HttpContext) {
    const data = await request.validateUsing(syncUserPermissionsValidator, {
      data: request.body(),
    })

    const service = await app.container.make(SyncUserPermissionsService)
    await service.handle({
      actorUserId: auth.getUserOrFail().id,
      userId: data.user_id,
      permissions: data.permissions,
    })

    return response.json({ message: 'User permissions synced successfully' })
  }

  /**
   * Get user permissions
   */
  async getUserPermissions({ request, params }: HttpContext) {
    const { id: userId } = await request.validateUsing(permissionUserIdParamValidator, {
      data: params,
    })

    const service = await app.container.make(CheckUserPermissionService)
    const permissions = await service.getUserPermissions(userId)

    return { permissions }
  }

  /**
   * Check if user has specific permissions
   */
  async checkUserPermissions({ request, params }: HttpContext) {
    const { id: userId } = await request.validateUsing(permissionUserIdParamValidator, {
      data: params,
    })
    const { permissions, require_all: requireAll = false } = await request.validateUsing(
      checkUserPermissionsValidator,
      { data: request.body() }
    )

    const service = await app.container.make(CheckUserPermissionService)
    const hasPermission = await service.handle(userId, permissions, requireAll)

    return { has_permission: hasPermission }
  }
}
