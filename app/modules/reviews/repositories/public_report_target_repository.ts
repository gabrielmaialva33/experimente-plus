import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import { discoverableEstablishmentExistsSql } from '#modules/catalog/repositories/catalog_discoverability'
import type IReview from '#modules/reviews/interfaces/review_interface'

/**
 * Whether a report target is something the public can see right now.
 *
 * A report is about something a person read. From the public surface that is
 * only what the public surface shows: a hidden review, the review of a banned
 * author, a draft or archived item, or anything of an establishment that left
 * the catalogue was never in front of the reporter. Accepting a report of it by
 * number would turn the report route into a way of asking which identifiers
 * exist behind the catalogue — and the anonymous route has no session to make
 * that asking costly.
 *
 * Every rule here is the rule the public reads already apply: the single
 * definition of discoverability, the ban of ADR-0027 §6, and the approved
 * snapshot of ADR-0028.
 */
export default class PublicReportTargetRepository {
  async isVisible(
    tenantId: number,
    type: IReview.ReportTargetType,
    id: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    const runner = client ?? db

    if (type === 'establishment') {
      return this.exists(
        runner,
        `SELECT EXISTS (${discoverableEstablishmentExistsSql}) AS visible`,
        [tenantId, id]
      )
    }

    if (type === 'review') {
      return this.exists(
        runner,
        `SELECT EXISTS (
           SELECT 1
             FROM establishment_reviews review
            WHERE review.tenant_id = ?
              AND review.id = ?
              AND ${PUBLIC_REVIEW}
         ) AS visible`,
        [tenantId, id, tenantId]
      )
    }

    if (type === 'reply') {
      return this.exists(
        runner,
        `SELECT EXISTS (
           SELECT 1
             FROM establishment_review_replies reply
             JOIN establishment_reviews review
               ON review.id = reply.review_id
              AND review.tenant_id = reply.tenant_id
            WHERE reply.tenant_id = ?
              AND reply.id = ?
              AND reply.status = 'published'
              AND ${PUBLIC_REVIEW}
         ) AS visible`,
        [tenantId, id, tenantId]
      )
    }

    return this.isPartnerContentVisible(tenantId, type, id, runner)
  }

  async isPartnerContentVisible(
    tenantId: number,
    kind: IReview.PartnerContentTarget,
    id: number,
    runner: TransactionClientContract | typeof db = db
  ): Promise<boolean> {
    const table = {
      experience: 'establishment_experiences',
      event: 'establishment_events',
      showcase_item: 'establishment_showcase_items',
    }[kind]

    return this.exists(
      runner,
      `SELECT EXISTS (
         SELECT 1
           FROM ${table} content
          WHERE content.tenant_id = ?
            AND content.id = ?
            AND content.published_snapshot IS NOT NULL
            AND content.status <> 'archived'
            AND EXISTS (${discoverableFor('content.establishment_id')})
       ) AS visible`,
      [tenantId, id, tenantId]
    )
  }

  private async exists(
    runner: TransactionClientContract | typeof db,
    sql: string,
    bindings: unknown[]
  ): Promise<boolean> {
    const result = await runner.rawQuery(sql, bindings)
    return result.rows[0]?.visible === true
  }
}

/** The discoverability revalidation, anchored on a column instead of a binding. */
function discoverableFor(column: string): string {
  return discoverableEstablishmentExistsSql.replace(
    'AND projection.establishment_id = ?',
    `AND projection.establishment_id = ${column}`
  )
}

/**
 * A review the public can read: published, its author not banned in this
 * operation, its establishment still discoverable. One binding: the tenant of
 * the discoverability check.
 */
const PUBLIC_REVIEW = `review.status = 'published'
              AND NOT EXISTS (
                SELECT 1
                  FROM user_tenants membership
                 WHERE membership.user_id = review.user_id
                   AND membership.tenant_id = review.tenant_id
                   AND membership.banned_at IS NOT NULL
              )
              AND EXISTS (${discoverableFor('review.establishment_id')})`
