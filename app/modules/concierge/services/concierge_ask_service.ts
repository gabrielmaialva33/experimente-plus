import { inject } from '@adonisjs/core'

import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import CatalogGroundingRepository from '#modules/concierge/repositories/catalog_grounding_repository'
import ConciergePolicyService from '#modules/concierge/services/concierge_policy_service'
import ConciergeQuotaService from '#modules/concierge/services/concierge_quota_service'
import ConciergeService from '#modules/concierge/services/concierge_service'
import ExplorerInterestRepository from '#modules/explorer/repositories/explorer_interest_repository'

type Question = { question: string; city?: string | null }

/**
 * One question to the Concierge, from either route — ADR-0029.
 *
 * Read-only by construction: it grounds the question in the published
 * catalogue, asks the assistant and returns the reply. Nothing here writes.
 */
@inject()
export default class ConciergeAskService {
  constructor(
    private grounding: CatalogGroundingRepository,
    private concierge: ConciergeService,
    private interests: ExplorerInterestRepository,
    private policies: ConciergePolicyService,
    private quota: ConciergeQuotaService
  ) {}

  async askPublic(tenantId: number, payload: Question): Promise<IConcierge.RouteReply> {
    // No person to count here: the public route stays under its per-address
    // throttle, and the daily quota applies to the signed-in question below.
    return this.reply(tenantId, payload, [])
  }

  /**
   * The interests only decide which discoverable places enter a prompt that
   * cannot hold them all. They are not sent to the model provider: a
   * preference is personal data, and the model does not need it to cite only
   * what it was given.
   */
  async askPersonal(
    tenantId: number,
    userId: number,
    payload: Question
  ): Promise<IConcierge.RouteReply> {
    const preferred = await this.interests.activeCategoryIdsFor(tenantId, userId)

    return this.reply(tenantId, payload, preferred, (limit) =>
      this.quota.consume(tenantId, userId, limit)
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
    tenantId: number,
    payload: Question,
    preferredCategoryIds: number[],
    consumeQuota?: (limit: number) => Promise<boolean>
  ): Promise<IConcierge.RouteReply> {
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

    return {
      ...reply,
      personalized: preferredCategoryIds.length > 0,
    }
  }
}
