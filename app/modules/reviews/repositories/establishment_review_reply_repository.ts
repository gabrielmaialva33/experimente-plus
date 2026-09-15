import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class EstablishmentReviewReplyRepository extends LucidRepository<
  typeof EstablishmentReviewReply
> {
  constructor() {
    super(EstablishmentReviewReply)
  }

  async findByReviewId(
    tenantId: number,
    reviewId: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentReviewReply | null> {
    return EstablishmentReviewReply.query({ client })
      .where('tenant_id', tenantId)
      .where('review_id', reviewId)
      .preload('organization')
      .preload('author', (userQuery) => {
        userQuery.select('id', 'full_name', 'username')
      })
      .first()
  }

  async findById(
    tenantId: number,
    id: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentReviewReply | null> {
    return EstablishmentReviewReply.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .first()
  }
}
