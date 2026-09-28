import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import GetDashboardStatsService from '#modules/web/services/get_dashboard_stats_service'

@inject()
export default class InertiaDashboardController {
  constructor(private getDashboardStats: GetDashboardStatsService) {}

  async index({ inertia, auth, tenant }: HttpContext) {
    const user = auth.getUserOrFail()
    const stats = await this.getDashboardStats.run({
      userId: user.id,
      tenantId: tenant?.id,
    })

    return inertia.render('dashboard', { stats })
  }
}
