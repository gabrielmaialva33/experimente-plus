import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BackofficeTodayService from '#modules/portal/services/backoffice_today_service'

@inject()
export default class BackofficeTodayController {
  constructor(private todayService: BackofficeTodayService) {}

  async index({ auth, inertia, response, tenant }: HttpContext) {
    const today = await this.todayService.overview(tenant!.id, auth.getUserOrFail())

    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
    return inertia.render('backoffice/today/index', today)
  }
}
