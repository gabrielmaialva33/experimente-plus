import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import { attachRoleValidator, listRolesValidator } from '#modules/roles/validators/roles_validator'

import ListRolesService from '#modules/roles/services/list_roles_service'
import SyncRolesService from '#modules/roles/services/sync_roles_service'

@inject()
export default class RolesController {
  async list({ request, response }: HttpContext) {
    const service = await app.container.make(ListRolesService)
    const {
      page = 1,
      per_page: perPage = 10,
      sort_by: sortBy = 'id',
      order: direction = 'asc',
    } = await request.validateUsing(listRolesValidator, { data: request.qs() })

    const roles = await service.run({ page, perPage, sortBy, direction })
    return response.json(roles)
  }

  async attach({ auth, request, response }: HttpContext) {
    const actor = auth.getUserOrFail()
    const { user_id: userId, role_ids: roleIds } = await request.validateUsing(
      attachRoleValidator,
      { data: request.body() }
    )

    const syncRolesService = await app.container.make(SyncRolesService)
    await syncRolesService.run({ actorUserId: actor.id, userId, roleIds })

    return response.json({
      message: 'Role attached successfully',
    })
  }
}
