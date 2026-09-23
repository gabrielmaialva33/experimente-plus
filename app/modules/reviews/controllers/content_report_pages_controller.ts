import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ContentReportService from '#modules/reviews/services/content_report_service'
import {
  listReportsQueryValidator,
  resolveReportValidator,
  reviewIdValidator,
} from '#modules/reviews/validators/review_validator'

/**
 * The human side of the report queue — ADR-0027 §6.
 *
 * The endpoints under `/api/v1/admin/content-reports` have existed since the
 * milestone landed, and until now the only way to work a report was curl. The
 * scope says the administrator approves, edits, deactivates or deletes, which
 * is a statement about a person, not about an endpoint.
 *
 * Authorization is enforced twice on purpose. The route carries the permission
 * the neighbouring queues carry, and the service independently requires a
 * platform moderator: the page is a second door onto the same decision, and a
 * second door with a weaker lock is how a queue becomes a way in.
 */
@inject()
export default class ContentReportPagesController {
  constructor(private reportService: ContentReportService) {}

  async index({ auth, inertia, request, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const tenantId = tenant!.id
    const actor = auth.getUserOrFail()
    const query = await request.validateUsing(listReportsQueryValidator)
    // Pending first by default: an empty queue is the normal state, and the
    // operation opens this screen to find what is waiting, not what is done.
    const status = query.status ?? 'pending'
    const reports = await this.reportService.listReportsForModeration(tenantId, actor, {
      ...query,
      status,
    })

    return inertia.render('backoffice/reports/index', {
      reports,
      filters: {
        status,
        target_type: query.target_type ?? null,
        page: query.page ?? 1,
        per_page: query.per_page ?? 20,
      },
      tenant_id: tenantId,
    })
  }

  async resolve({ auth, params, request, response, session, tenant }: HttpContext) {
    const { id } = await reviewIdValidator.validate(params)
    const payload = await request.validateUsing(resolveReportValidator)
    const report = await this.reportService.resolveReport(
      tenant!.id,
      id,
      auth.getUserOrFail(),
      payload
    )

    // The protocol is how the operation refers to the case afterwards
    // (ADR-0027 scenario 12), so the confirmation names it rather than the row.
    session.flash(
      'success',
      payload.status === 'resolved'
        ? `Denúncia ${report.protocol_number} resolvida.`
        : `Denúncia ${report.protocol_number} descartada.`
    )
    return response.redirect().back()
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
