import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ContentReportDeadlineService from '#modules/reviews/services/content_report_deadline_service'
import ContentReportService from '#modules/reviews/services/content_report_service'
import UserBanService from '#modules/reviews/services/user_ban_service'
import {
  banPayloadValidator,
  listReportsQueryValidator,
  resolveReportValidator,
  reviewIdValidator,
  unbanPayloadValidator,
  userIdParamsValidator,
} from '#modules/reviews/validators/review_validator'

/**
 * The human side of the report queue — ADR-0027 §6.
 *
 * The endpoints under `/api/v1/admin/content-reports` have existed since the
 * milestone landed, and until now the only way to work a report was curl. The
 * scope says the administrator approves, edits, deactivates or deletes, which
 * is a statement about a person, not about an endpoint.
 *
 * Authorization is decided in the service, which requires a platform
 * moderator. The route permission admits every authenticated person, since the
 * ordinary role holds the establishment permissions partners need, so this
 * controller must never grow an action that skips the service.
 */
@inject()
export default class ContentReportPagesController {
  constructor(
    private reportService: ContentReportService,
    private bans: UserBanService,
    private deadlines: ContentReportDeadlineService
  ) {}

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

    // Across the whole operation, not the page: a deadline is missed by a case,
    // wherever the pagination happens to put it.
    const overdueTotal = await this.deadlines.countOverdue(tenantId, actor)

    return inertia.render('backoffice/reports/index', {
      reports,
      overdue_total: overdueTotal,
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

  /**
   * Bans the author of a reported review, from the queue where the pattern of
   * abuse is actually seen. The ban hides every review of that person in this
   * operation, not only the reported one — which is why it is a separate act
   * from resolving the report, with its own reason.
   */
  async banAuthor({ auth, params, request, response, session, tenant }: HttpContext) {
    const { userId } = await userIdParamsValidator.validate(params)
    const payload = await request.validateUsing(banPayloadValidator)
    await this.bans.ban(tenant!.id, auth.getUserOrFail(), userId, payload)
    session.flash('success', 'Autor banido. As avaliações dele saíram das áreas públicas.')
    return response.redirect().back()
  }

  async unbanAuthor({ auth, params, request, response, session, tenant }: HttpContext) {
    const { userId } = await userIdParamsValidator.validate(params)
    const payload = await request.validateUsing(unbanPayloadValidator)
    await this.bans.unban(tenant!.id, auth.getUserOrFail(), userId, payload)
    session.flash('success', 'Banimento retirado. As avaliações publicadas voltaram.')
    return response.redirect().back()
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
