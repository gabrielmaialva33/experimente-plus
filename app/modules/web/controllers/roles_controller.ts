import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ListRolesWithPermissionsService from '#modules/web/services/list_roles_with_permissions_service'

@inject()
export default class InertiaRolesController {
  constructor(private listRoles: ListRolesWithPermissionsService) {}

  async index({ inertia }: HttpContext) {
    const roles = await this.listRoles.run()

    return inertia.render('roles/index', { roles })
  }
}
