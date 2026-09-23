import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import db from '@adonisjs/lucid/services/db'

import { discoverableEstablishmentExistsSql } from '#modules/catalog/repositories/catalog_discoverability'
import type IReview from '#modules/reviews/interfaces/review_interface'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class EstablishmentReviewRepository extends LucidRepository<
  typeof EstablishmentReview
> {
  constructor() {
    super(EstablishmentReview)
  }

  async findById(
    tenantId: number,
    id: number,
    client?: TransactionClientContract,
    lock = false
  ): Promise<EstablishmentReview | null> {
    const query = EstablishmentReview.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .preload('photos', (photoQuery) => {
        photoQuery.orderBy('sort_order', 'asc').preload('asset', (asset) => asset.preload('file'))
      })
      .preload('reply', (replyQuery) => {
        replyQuery.where('status', 'published')
      })
      .preload('author', (userQuery) => {
        userQuery.select('id', 'full_name', 'username')
      })

    if (lock) {
      query.forUpdate()
    }

    return query.first()
  }

  /** Whether the establishment is publicly discoverable right now. */
  async isEstablishmentDiscoverable(tenantId: number, establishmentId: number): Promise<boolean> {
    const result = await db.rawQuery(
      `SELECT EXISTS (${discoverableEstablishmentExistsSql}) AS present`,
      [tenantId, establishmentId]
    )
    return result.rows[0]?.present === true
  }

  async findByUserAndEstablishment(
    tenantId: number,
    userId: number,
    establishmentId: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentReview | null> {
    return EstablishmentReview.query({ client })
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .where('establishment_id', establishmentId)
      .first()
  }

  async countUserReviewsSince(
    tenantId: number,
    userId: number,
    since: Date,
    client?: TransactionClientContract
  ): Promise<number> {
    const result = await EstablishmentReview.query({ client })
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .where('created_at', '>=', since)
      .count('* as total')
      .first()

    return Number(result?.$extras.total ?? 0)
  }

  async paginateForEstablishment(
    tenantId: number,
    establishmentId: number,
    query: IReview.ListReviewsQuery
  ) {
    const rows = EstablishmentReview.query()
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('status', 'published')
      // Reviews belong to the establishment's public page, so they leave with
      // it: an establishment that was suspended, archived or whose city was
      // deactivated takes its reviews out of public view too (Anexo I items 8
      // and 14). The single definition of discoverability decides, as it does
      // for partner content and the Concierge.
      .whereRaw(`EXISTS (${discoverableEstablishmentExistsSql})`, [tenantId, establishmentId])
      // A banned author's reviews leave public view without their status being
      // touched (ADR-0027 §6). The aggregate in the projection applies the same
      // rule, so the list and the average can never disagree.
      .whereNotExists((membership) => {
        membership
          .from('user_tenants')
          .whereColumn('user_tenants.user_id', 'establishment_reviews.user_id')
          .whereColumn('user_tenants.tenant_id', 'establishment_reviews.tenant_id')
          .whereNotNull('user_tenants.banned_at')
      })
      .preload('photos', (photoQuery) => {
        photoQuery.orderBy('sort_order', 'asc').preload('asset', (asset) => asset.preload('file'))
      })
      .preload('reply', (replyQuery) => {
        replyQuery.where('status', 'published')
      })
      .preload('author', (userQuery) => {
        userQuery.select('id', 'full_name', 'username')
      })
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    if (query.rating !== undefined) {
      rows.where('rating', query.rating)
    }

    const page = query.page ?? 1
    const perPage = query.per_page ?? 10
    return rows.paginate(page, perPage)
  }

  async paginateForUser(tenantId: number, userId: number, query: IReview.ListReviewsQuery) {
    const rows = EstablishmentReview.query()
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .preload('establishment', (estQuery) => {
        estQuery.preload('published_revision')
      })
      .preload('photos', (photoQuery) => {
        photoQuery.orderBy('sort_order', 'asc').preload('asset', (asset) => asset.preload('file'))
      })
      .preload('reply', (replyQuery) => {
        replyQuery.where('status', 'published')
      })
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    if (query.status !== undefined) {
      rows.where('status', query.status)
    }

    const page = query.page ?? 1
    const perPage = query.per_page ?? 10
    return rows.paginate(page, perPage)
  }

  async paginateForTenant(tenantId: number, query: IReview.ListReviewsQuery) {
    const rows = EstablishmentReview.query()
      .where('tenant_id', tenantId)
      .preload('establishment')
      .preload('photos', (photoQuery) => {
        photoQuery.orderBy('sort_order', 'asc').preload('asset', (asset) => asset.preload('file'))
      })
      .preload('author', (userQuery) => {
        userQuery.select('id', 'full_name', 'username', 'email')
      })
      .preload('reply')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    if (query.status !== undefined) {
      rows.where('status', query.status)
    }
    if (query.rating !== undefined) {
      rows.where('rating', query.rating)
    }

    const page = query.page ?? 1
    const perPage = query.per_page ?? 10
    return rows.paginate(page, perPage)
  }
}
