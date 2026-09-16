import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import { conciergeAskValidator } from '#modules/concierge/validators/concierge_validator'
import CatalogGroundingRepository from '#modules/concierge/repositories/catalog_grounding_repository'
import ConciergeService from '#modules/concierge/services/concierge_service'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'
import env from '#start/env'

@inject()
export default class ConciergeController {
  constructor(
    private operationResolver: PublicOperationResolver,
    private grounding: CatalogGroundingRepository,
    private concierge: ConciergeService
  ) {}

  /**
   * Discovery assistance over the published catalogue — ADR-0029.
   *
   * Public like the rest of discovery, and read-only by construction: this
   * module has no write path, so it cannot reserve, purchase or confirm
   * anything, as the contracted scope requires.
   */
  async ask({ request, response }: HttpContext) {
    const payload = await request.validateUsing(conciergeAskValidator)
    const tenant = await this.operationResolver.resolve(request.hostname())

    const { offered, withheld } = await this.grounding.forQuestion(
      tenant.id,
      payload.city ?? null,
      env.get('CONCIERGE_MAX_CATALOG_ITEMS', 20)
    )

    const reply = await this.concierge.answer(payload.question, offered, withheld)

    // Never cached: the answer depends on the question, and a shared cache
    // would hand one consumer's reply to another.
    response.header('cache-control', 'no-store')
    return response.ok(reply)
  }
}
