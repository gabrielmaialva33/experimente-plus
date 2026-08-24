import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import AnalyticsDashboardService from '#modules/analytics/services/analytics_dashboard_service'
import { adminSearchAnalyticsValidator } from '#modules/analytics/validators/analytics_validator'

@inject()
export default class AdminAnalyticsController {
  constructor(private dashboardService: AnalyticsDashboardService) {}

  async noResultSearches({ auth, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(adminSearchAnalyticsValidator)
    const result = await this.dashboardService.searchTerms(tenant!.id, auth.getUserOrFail(), query)

    return response.ok(result)
  }
}
