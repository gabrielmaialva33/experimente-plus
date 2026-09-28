import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ListAllPermissionsService from '#modules/web/services/list_all_permissions_service'

@inject()
export default class InertiaPermissionsController {
  constructor(private listPermissions: ListAllPermissionsService) {}

  async index({ inertia }: HttpContext) {
    const permissions = await this.listPermissions.run()

    return inertia.render('permissions/index', { permissions })
  }
}
