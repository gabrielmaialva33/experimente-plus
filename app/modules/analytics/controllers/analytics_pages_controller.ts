import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ForbiddenException from '#exceptions/forbidden_exception'
import AnalyticsDashboardService from '#modules/analytics/services/analytics_dashboard_service'
import { analyticsDateRangeValidator } from '#modules/analytics/validators/analytics_validator'

@inject()
export default class AnalyticsPagesController {
  constructor(private dashboardService: AnalyticsDashboardService) {}

  async organization({ auth, inertia, params, request, response, session, tenant }: HttpContext) {
    const query = await request.validateUsing(analyticsDateRangeValidator)
    const organizationId = Number(params.organizationId)
    let dashboard: Awaited<ReturnType<AnalyticsDashboardService['organizationDashboard']>>
    try {
      dashboard = await this.dashboardService.organizationDashboard(
        tenant!.id,
        organizationId,
        auth.getUserOrFail(),
        query
      )
    } catch (error) {
      // A member whose role has no analytics (an editor) followed a stale or
      // typed link: back to the organization with the reason, as "Desempenho"
      // in the menu does, instead of a bare 403. Outsiders still get the 404.
      if (!(error instanceof ForbiddenException)) {
        throw error
      }
      session.flash(
        'warning',
        'O desempenho fica disponível para proprietários, administradores e analistas da organização.'
      )
      return response.redirect().toPath(`/portal/organizations/${organizationId}`)
    }

    response.header('Cache-Control', 'private, no-store')
    response.header('X-Robots-Tag', 'noindex, nofollow')

    return inertia.render('analytics/organization', { dashboard })
  }
}
