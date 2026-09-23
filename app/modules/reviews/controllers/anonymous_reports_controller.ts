import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import AnonymousReportService from '#modules/reviews/services/anonymous_report_service'
import { createAnonymousReportValidator } from '#modules/reviews/validators/review_validator'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

/**
 * Reporting without an account — ADR-0027 scenarios 13 and 14.
 *
 * The operation comes from the trusted hostname, like every public catalogue
 * read (ADR-0003); a visitor never names a tenant. The answer is the protocol
 * and nothing else: not the hashes, not the report, nothing that could tell the
 * reporter — or anyone replaying the request — how the origin was recorded.
 */
@inject()
export default class AnonymousReportsController {
  constructor(
    private reports: AnonymousReportService,
    private publicResolver: PublicOperationResolver
  ) {}

  async store({ request, response }: HttpContext) {
    const { anonymous_token: token, ...payload } = await request.validateUsing(
      createAnonymousReportValidator
    )
    const tenant = await this.publicResolver.resolve(request.hostname())
    const report = await this.reports.create(tenant.id, payload, {
      ip: request.ip(),
      token: token ?? null,
    })

    return response.created({ protocol_number: report.protocol_number })
  }
}
