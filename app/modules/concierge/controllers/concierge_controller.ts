import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import { conciergeAskValidator } from '#modules/concierge/validators/concierge_validator'
import CatalogGroundingRepository from '#modules/concierge/repositories/catalog_grounding_repository'
import ConciergePolicyService from '#modules/concierge/services/concierge_policy_service'
import ConciergeQuotaService from '#modules/concierge/services/concierge_quota_service'
import ConciergeService from '#modules/concierge/services/concierge_service'
import ExplorerInterestRepository from '#modules/explorer/repositories/explorer_interest_repository'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

@inject()
export default class ConciergeController {
  constructor(
    private operationResolver: PublicOperationResolver,
    private grounding: CatalogGroundingRepository,
    private concierge: ConciergeService,
    private interests: ExplorerInterestRepository,
    private policies: ConciergePolicyService,
    private quota: ConciergeQuotaService
  ) {}

  /**
   * Discovery assistance over the published catalogue — ADR-0029.
   *
   * Public like the rest of discovery, and read-only by construction: this
   * module has no write path, so it cannot reserve, purchase or confirm
   * anything, as the contracted scope requires.
   *
   * It never reads credentials. A token sent here is ignored rather than used,
   * so the public answer cannot depend on who asked; the personal variant is a
   * separate route under `/api/v1/me`, where the session is required.
   */
  async ask({ request, response }: HttpContext) {
    const payload = await request.validateUsing(conciergeAskValidator)
    const tenant = await this.operationResolver.resolve(request.hostname())

    // No person to count here: the public route stays under its per-address
    // throttle, and the daily quota applies to the signed-in route below.
    return this.reply(response, tenant.id, payload, [])
  }

  /**
   * The same assistant for a signed-in Explorer — Anexo I item 11, "com base
   * nos dados disponíveis e, quando aplicável, nos interesses do Explorador".
   *
   * The operation comes from the session, as for the rest of `/api/v1/me`, and
   * the interests only decide which discoverable places enter a prompt that
   * cannot hold them all. They are not sent to the model provider: a
   * preference is personal data, and the model does not need it to cite only
   * what it was given.
   */
  async askPersonal({ auth, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(conciergeAskValidator)
    const user = auth.getUserOrFail()
    const preferred = await this.interests.activeCategoryIdsFor(tenant!.id, user.id)

    return this.reply(response, tenant!.id, payload, preferred, (limit) =>
      this.quota.consume(tenant!.id, user.id, limit)
    )
  }

  /**
   * The operation's policy decides whether a model is consulted and how much
   * of the catalogue a question sees (ADR-0029, revision of 26/09/2026). Past
   * the daily quota, or with the assistant switched off, the reply is the same
   * degraded one an unconfigured deployment gives — the catalogue, no model —
   * so the outcomes the app knows stay the only ones it can receive.
   */
  private async reply(
    response: HttpContext['response'],
    tenantId: number,
    payload: { question: string; city?: string | null },
    preferredCategoryIds: number[],
    consumeQuota?: (limit: number) => Promise<boolean>
  ) {
    const policy = await this.policies.effective(tenantId)
    const { offered, withheld } = await this.grounding.forQuestion(
      tenantId,
      payload.city ?? null,
      policy.max_catalog_items,
      new Date(),
      preferredCategoryIds
    )

    const reply = await this.concierge.answer(payload.question, offered, withheld, {
      enabled: policy.enabled,
      admit: consumeQuota ? () => consumeQuota(policy.daily_questions_per_person) : undefined,
    })
    const body: IConcierge.RouteReply = {
      ...reply,
      personalized: preferredCategoryIds.length > 0,
    }

    // Never cached: the answer depends on the question, and a shared cache
    // would hand one consumer's reply to another. The personal route already
    // carries `private, no-store` from its middleware, which must not be
    // weakened here.
    if (!response.getHeader('cache-control')) {
      response.header('cache-control', 'no-store')
    }
    return response.ok(body)
  }
}
