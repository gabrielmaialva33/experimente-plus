import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import IReview from '#modules/reviews/interfaces/review_interface'
import AutomaticModerationPolicy from '#modules/reviews/models/automatic_moderation_policy'

export default class AutomaticModerationPolicyRepository {
  /**
   * The operation's rules, created with the provisional defaults on first
   * read. The defaults are written explicitly rather than left to the column
   * defaults, because Lucid does not read column defaults back after insert.
   */
  async getForTenant(
    tenantId: number,
    client?: TransactionClientContract
  ): Promise<AutomaticModerationPolicy> {
    const existing = await AutomaticModerationPolicy.query({ client })
      .where('tenant_id', tenantId)
      .first()
    if (existing) return existing

    return AutomaticModerationPolicy.create(
      { tenant_id: tenantId, ...IReview.DEFAULT_AUTOMATIC_MODERATION_POLICY, blocked_terms: [] },
      { client }
    )
  }

  async updateForTenant(
    tenantId: number,
    payload: IReview.UpdateAutomaticModerationPolicyPayload,
    client?: TransactionClientContract
  ): Promise<AutomaticModerationPolicy> {
    const policy = await this.getForTenant(tenantId, client)
    if (client) policy.useTransaction(client)
    policy.merge(payload)
    await policy.save()
    return policy
  }
}
