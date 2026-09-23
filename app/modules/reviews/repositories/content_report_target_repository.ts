import db from '@adonisjs/lucid/services/db'

import type IReview from '#modules/reviews/interfaces/review_interface'
import type ContentReport from '#modules/reviews/models/content_report'

/**
 * Resolves what a batch of reports actually points at — ADR-0027 §6.
 *
 * One query per target species, never one per report: a queue page holds ten
 * reports and the naive shape would issue ten round trips to say ten sentences.
 *
 * Everything is read through the report's own tenant. A report and its target
 * belong to the same operation by construction, and re-stating the tenant on
 * the target query is what keeps a crafted `target_id` from reaching across
 * operations if one ever stopped being true.
 */
export default class ContentReportTargetRepository {
  async projectFor(
    tenantId: number,
    reports: ContentReport[]
  ): Promise<Map<number, IReview.ReportTargetProjection>> {
    const idsOf = (type: IReview.ReportTargetType) => [
      ...new Set(
        reports.filter((report) => report.target_type === type).map((report) => report.target_id)
      ),
    ]

    const [reviews, replies, establishments] = await Promise.all([
      this.reviews(tenantId, idsOf('review')),
      this.replies(tenantId, idsOf('reply')),
      this.establishments(tenantId, idsOf('establishment')),
    ])

    const found = { review: reviews, reply: replies, establishment: establishments }
    const projections = new Map<number, IReview.ReportTargetProjection>()

    for (const report of reports) {
      const projection = found[report.target_type]?.get(report.target_id)
      projections.set(report.id, projection ?? this.missing(report.target_type, report.target_id))
    }

    return projections
  }

  /**
   * A target the report outlived.
   *
   * Content can be deleted after it was reported, and the queue still has to
   * render the case: hiding the row would leave a protocol number the operation
   * can be asked about and cannot open.
   */
  private missing(type: IReview.ReportTargetType, id: number): IReview.ReportTargetProjection {
    return {
      type,
      id,
      exists: false,
      text: null,
      rating: null,
      status: null,
      author_name: null,
      author_id: null,
      author_banned: false,
      establishment_name: null,
      city_slug: null,
      establishment_slug: null,
      created_at: null,
      can_hide: false,
    }
  }

  private instant(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  private async reviews(
    tenantId: number,
    ids: number[]
  ): Promise<Map<number, IReview.ReportTargetProjection>> {
    if (ids.length === 0) return new Map()

    const rows = await db
      .from('establishment_reviews as review')
      .leftJoin('users as author', 'author.id', 'review.user_id')
      .leftJoin('user_tenants as membership', (join) => {
        join
          .on('membership.user_id', 'review.user_id')
          .andOn('membership.tenant_id', 'review.tenant_id')
      })
      .leftJoin('establishments as establishment', (join) => {
        join
          .on('establishment.id', 'review.establishment_id')
          .andOn('establishment.tenant_id', 'review.tenant_id')
      })
      .leftJoin('establishment_revisions as revision', (join) => {
        join
          .on('revision.id', 'establishment.published_revision_id')
          .andOn('revision.tenant_id', 'establishment.tenant_id')
      })
      .leftJoin('cities as city', (join) => {
        join.on('city.id', 'revision.city_id').andOn('city.tenant_id', 'revision.tenant_id')
      })
      .where('review.tenant_id', tenantId)
      .whereIn('review.id', ids)
      .select(
        'review.id',
        'review.comment',
        'review.rating',
        'review.status',
        'review.created_at',
        'review.user_id as author_id',
        'membership.banned_at as author_banned_at',
        'author.full_name as author_name',
        'revision.public_name as establishment_name',
        'revision.slug as establishment_slug',
        'city.slug as city_slug'
      )

    return new Map(
      rows.map((row) => [
        Number(row.id),
        {
          type: 'review' as const,
          id: Number(row.id),
          exists: true,
          text: row.comment ?? null,
          rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
          status: row.status ?? null,
          author_name: row.author_name ?? null,
          author_id: Number(row.author_id),
          author_banned: row.author_banned_at !== null && row.author_banned_at !== undefined,
          establishment_name: row.establishment_name ?? null,
          city_slug: row.city_slug ?? null,
          establishment_slug: row.establishment_slug ?? null,
          created_at: this.instant(row.created_at),
          can_hide: true,
        },
      ])
    )
  }

  private async replies(
    tenantId: number,
    ids: number[]
  ): Promise<Map<number, IReview.ReportTargetProjection>> {
    if (ids.length === 0) return new Map()

    const rows = await db
      .from('establishment_review_replies as reply')
      .leftJoin('users as author', 'author.id', 'reply.user_id')
      .leftJoin('establishment_reviews as review', (join) => {
        join.on('review.id', 'reply.review_id').andOn('review.tenant_id', 'reply.tenant_id')
      })
      .leftJoin('establishments as establishment', (join) => {
        join
          .on('establishment.id', 'review.establishment_id')
          .andOn('establishment.tenant_id', 'review.tenant_id')
      })
      .leftJoin('establishment_revisions as revision', (join) => {
        join
          .on('revision.id', 'establishment.published_revision_id')
          .andOn('revision.tenant_id', 'establishment.tenant_id')
      })
      .leftJoin('cities as city', (join) => {
        join.on('city.id', 'revision.city_id').andOn('city.tenant_id', 'revision.tenant_id')
      })
      .where('reply.tenant_id', tenantId)
      .whereIn('reply.id', ids)
      .select(
        'reply.id',
        'reply.comment',
        'reply.status',
        'reply.created_at',
        'author.full_name as author_name',
        'revision.public_name as establishment_name',
        'revision.slug as establishment_slug',
        'city.slug as city_slug'
      )

    return new Map(
      rows.map((row) => [
        Number(row.id),
        {
          type: 'reply' as const,
          id: Number(row.id),
          exists: true,
          text: row.comment ?? null,
          rating: null,
          status: row.status ?? null,
          author_name: row.author_name ?? null,
          author_id: null,
          author_banned: false,
          establishment_name: row.establishment_name ?? null,
          city_slug: row.city_slug ?? null,
          establishment_slug: row.establishment_slug ?? null,
          created_at: this.instant(row.created_at),
          can_hide: true,
        },
      ])
    )
  }

  private async establishments(
    tenantId: number,
    ids: number[]
  ): Promise<Map<number, IReview.ReportTargetProjection>> {
    if (ids.length === 0) return new Map()

    const rows = await db
      .from('establishments as establishment')
      .leftJoin('establishment_revisions as revision', (join) => {
        join
          .on('revision.id', 'establishment.published_revision_id')
          .andOn('revision.tenant_id', 'establishment.tenant_id')
      })
      .leftJoin('cities as city', (join) => {
        join.on('city.id', 'revision.city_id').andOn('city.tenant_id', 'revision.tenant_id')
      })
      .where('establishment.tenant_id', tenantId)
      .whereIn('establishment.id', ids)
      .select(
        'establishment.id',
        'establishment.lifecycle_status',
        'establishment.created_at',
        'revision.public_name as establishment_name',
        'revision.slug as establishment_slug',
        'revision.short_description',
        'city.slug as city_slug'
      )

    return new Map(
      rows.map((row) => [
        Number(row.id),
        {
          type: 'establishment' as const,
          id: Number(row.id),
          exists: true,
          text: row.short_description ?? null,
          rating: null,
          status: row.lifecycle_status ?? null,
          author_name: null,
          author_id: null,
          author_banned: false,
          establishment_name: row.establishment_name ?? null,
          city_slug: row.city_slug ?? null,
          establishment_slug: row.establishment_slug ?? null,
          created_at: this.instant(row.created_at),
          // An establishment leaves the catalogue through its revision
          // lifecycle, not through a report resolution.
          can_hide: false,
        },
      ])
    )
  }
}
