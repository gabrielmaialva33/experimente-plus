import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import EstablishmentReviewPhoto from '#modules/reviews/models/establishment_review_photo'

/** Photos of a review — ADR-0027. Always read with the asset and file behind them. */
export default class ReviewPhotoRepository {
  async countForReview(
    tenantId: number,
    reviewId: number,
    client: TransactionClientContract
  ): Promise<number> {
    const row = await EstablishmentReviewPhoto.query({ client })
      .where('tenant_id', tenantId)
      .where('review_id', reviewId)
      .count('* as total')
      .first()
    return Number(row?.$extras.total ?? 0)
  }

  async nextSortOrder(
    tenantId: number,
    reviewId: number,
    client: TransactionClientContract
  ): Promise<number> {
    const row = await EstablishmentReviewPhoto.query({ client })
      .where('tenant_id', tenantId)
      .where('review_id', reviewId)
      .max('sort_order as highest')
      .first()
    const highest = row?.$extras.highest
    return highest === null || highest === undefined ? 0 : Number(highest) + 1
  }

  async findForReview(
    tenantId: number,
    reviewId: number,
    photoId: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentReviewPhoto | null> {
    return EstablishmentReviewPhoto.query({ client })
      .where('tenant_id', tenantId)
      .where('review_id', reviewId)
      .where('id', photoId)
      .preload('asset', (asset) => asset.preload('file'))
      .first()
  }

  async findWithAsset(tenantId: number, photoId: number): Promise<EstablishmentReviewPhoto> {
    return EstablishmentReviewPhoto.query()
      .where('tenant_id', tenantId)
      .where('id', photoId)
      .preload('asset', (asset) => asset.preload('file'))
      .firstOrFail()
  }
}
