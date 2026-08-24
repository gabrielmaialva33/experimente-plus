import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import AnalyticsDashboardService from '#modules/analytics/services/analytics_dashboard_service'
import { analyticsDateRangeValidator } from '#modules/analytics/validators/analytics_validator'

@inject()
export default class AnalyticsPagesController {
  constructor(private dashboardService: AnalyticsDashboardService) {}

  async organization({ auth, inertia, params, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(analyticsDateRangeValidator)
    const dashboard = await this.dashboardService.organizationDashboard(
      tenant!.id,
      Number(params.organizationId),
      auth.getUserOrFail(),
      query
    )

    response.header('Cache-Control', 'private, no-store')
    response.header('X-Robots-Tag', 'noindex, nofollow')

    return inertia.render('analytics/organization', { dashboard })
  }
}
