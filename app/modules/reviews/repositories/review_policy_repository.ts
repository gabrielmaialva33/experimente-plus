import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import IReview from '#modules/reviews/interfaces/review_interface'
import ReviewPolicy from '#modules/reviews/models/review_policy'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class ReviewPolicyRepository extends LucidRepository<typeof ReviewPolicy> {
  constructor() {
    super(ReviewPolicy)
  }

  async getForTenant(
    tenantId: number,
    client?: TransactionClientContract
  ): Promise<ReviewPolicy> {
    const existing = await ReviewPolicy.query({ client })
      .where('tenant_id', tenantId)
      .first()

    if (existing) {
      return existing
    }

    return ReviewPolicy.create(
      {
        tenant_id: tenantId,
        ...IReview.DEFAULT_REVIEW_POLICY,
      },
      { client }
    )
  }

  async updateForTenant(
    tenantId: number,
    payload: IReview.UpdateReviewPolicyPayload,
    client?: TransactionClientContract
  ): Promise<ReviewPolicy> {
    const policy = await this.getForTenant(tenantId, client)
    if (client) {
      policy.useTransaction(client)
    }

    policy.merge(payload)
    await policy.save()
    return policy
  }
}
