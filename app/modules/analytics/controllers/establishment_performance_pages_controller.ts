import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ForbiddenException from '#exceptions/forbidden_exception'
import EstablishmentPerformanceService from '#modules/analytics/services/establishment_performance_service'
import { parsePerformancePeriod } from '#modules/analytics/utils/performance_period'

@inject()
export default class EstablishmentPerformancePagesController {
  constructor(private performanceService: EstablishmentPerformanceService) {}

  /** "Desempenho" of one place in the partner portal. */
  async show({ auth, inertia, params, request, response, session, tenant }: HttpContext) {
    const establishmentId = Number(params.establishmentId)
    let page: Awaited<ReturnType<EstablishmentPerformanceService['page']>>
    try {
      page = await this.performanceService.page(tenant!.id, establishmentId, auth.getUserOrFail(), {
        // A typed or stale period opens the default one instead of an error.
        period: parsePerformancePeriod(request.qs().period),
      })
    } catch (error) {
      // A member whose role has no analytics (an editor) followed a stale or
      // typed link: back to the place with the reason, as the organization's
      // "Desempenho" does. Outsiders still get the 404.
      if (!(error instanceof ForbiddenException)) {
        throw error
      }
      session.flash(
        'warning',
        'O desempenho fica disponível para proprietários, administradores e analistas da organização.'
      )
      return response.redirect().toPath(`/portal/establishments/${establishmentId}`)
    }

    response.header('Cache-Control', 'private, no-store')
    response.header('X-Robots-Tag', 'noindex, nofollow')

    return inertia.render('portal/establishments/performance', page)
  }
}
