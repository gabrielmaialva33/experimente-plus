import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import db from '@adonisjs/lucid/services/db'

import { discoverableEstablishmentExistsSql } from '#modules/catalog/repositories/catalog_discoverability'
import type IReview from '#modules/reviews/interfaces/review_interface'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import LucidRepository from '#shared/lucid/lucid_repository'

/** A reply exists for the review in the outer query: the partner's "answered". */
const PARTNER_REPLY_EXISTS_SQL = `EXISTS (
  SELECT 1 FROM establishment_review_replies
  WHERE establishment_review_replies.review_id = establishment_reviews.id
    AND establishment_review_replies.tenant_id = establishment_reviews.tenant_id
)`

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

  /** Hide the review. Only the status changes. */
  async hide(tenantId: number, id: number, client: TransactionClientContract): Promise<void> {
    await EstablishmentReview.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .update({ status: 'hidden' })
  }

  /** Publish the review again if it is hidden. */
  async republishHidden(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<void> {
    await EstablishmentReview.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .where('status', 'hidden')
      .update({ status: 'published', updated_at: new Date() })
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

  /**
   * The reviews a partner answers, one page at a time — Anexo I items 3 and 8.
   *
   * The portal's Avaliações page and the count on its overview both read
   * `partnerReviews`, so the list and the number can never disagree: published
   * reviews of the given places, without a banned author's, which the public no
   * longer sees either (ADR-0027 §6). A reply of any status counts as an answer:
   * a reply the moderation holds was still written, and answering twice is not
   * allowed.
   */
  async paginateForPartner(
    tenantId: number,
    establishmentIds: number[],
    filter: IReview.PartnerReviewFilter,
    page: number,
    perPage: number
  ) {
    const rows = this.partnerReviews(tenantId, establishmentIds)
      .preload('photos', (photoQuery) => {
        photoQuery.orderBy('sort_order', 'asc').preload('asset', (asset) => asset.preload('file'))
      })
      .preload('reply')
      .preload('author', (userQuery) => {
        userQuery.select('id', 'full_name', 'username')
      })
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    if (filter === 'answered') rows.whereRaw(PARTNER_REPLY_EXISTS_SQL)
    if (filter === 'unanswered') rows.whereRaw(`NOT ${PARTNER_REPLY_EXISTS_SQL}`)

    return rows.paginate(page, perPage)
  }

  /** Per place: how many reviews, how many answered, and their average rating. */
  async partnerSummaries(
    tenantId: number,
    establishmentIds: number[]
  ): Promise<Map<number, IReview.PartnerReviewSummary>> {
    const summaries = new Map<number, IReview.PartnerReviewSummary>()
    if (establishmentIds.length === 0) return summaries

    const rows = await this.partnerReviews(tenantId, establishmentIds)
      .leftJoin('establishment_review_replies', (join) => {
        join
          .on('establishment_review_replies.review_id', 'establishment_reviews.id')
          .andOn('establishment_review_replies.tenant_id', 'establishment_reviews.tenant_id')
      })
      .groupBy('establishment_reviews.establishment_id')
      .select('establishment_reviews.establishment_id')
      .select(db.raw('count(*)::int as total'))
      .select(db.raw('count(establishment_review_replies.id)::int as answered'))
      .select(db.raw('avg(establishment_reviews.rating)::float as average'))
      .pojo<{ establishment_id: number; total: number; answered: number; average: number | null }>()

    for (const row of rows) {
      const total = Number(row.total)
      const answered = Number(row.answered)
      summaries.set(Number(row.establishment_id), {
        total,
        answered,
        unanswered: total - answered,
        average: row.average === null ? null : Number(row.average),
      })
    }
    return summaries
  }

  private partnerReviews(tenantId: number, establishmentIds: number[]) {
    return EstablishmentReview.query()
      .where('establishment_reviews.tenant_id', tenantId)
      .whereIn('establishment_reviews.establishment_id', establishmentIds)
      .where('establishment_reviews.status', 'published')
      .whereNotExists((membership) => {
        membership
          .from('user_tenants')
          .whereColumn('user_tenants.user_id', 'establishment_reviews.user_id')
          .whereColumn('user_tenants.tenant_id', 'establishment_reviews.tenant_id')
          .whereNotNull('user_tenants.banned_at')
      })
  }

  /**
   * The reviews among these that an automatic rule is holding and nobody has
   * decided yet.
   *
   * A held review is `hidden`, like one a moderator hid on its merits; what
   * tells them apart is an open automatic report that holds it. The author is
   * owed the difference: "under review" and "hidden by moderation" are not the
   * same news.
   */
  async awaitingModeration(tenantId: number, reviewIds: number[]): Promise<Set<number>> {
    if (reviewIds.length === 0) return new Set()
    const rows = await db
      .from('content_reports')
      .where('tenant_id', tenantId)
      .where('target_type', 'review')
      .whereIn('target_id', reviewIds)
      .where('origin', 'automatic')
      .where('holds_content', true)
      .whereIn('status', ['pending', 'under_review'])
      .distinct('target_id')

    return new Set(rows.map((row) => Number(row.target_id)))
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
