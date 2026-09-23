import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IReview from '#modules/reviews/interfaces/review_interface'
import IRole from '#modules/roles/interfaces/role_interface'

/** A report still waiting for a decision. Resolved and dismissed ones never are. */
const OPEN_STATUSES: IReview.ReportStatus[] = ['pending', 'under_review']

/** The global roles that can work the report queue (ADR-0007). */
const STAFF_ROLES = [IRole.Slugs.ROOT, IRole.Slugs.ADMIN, IRole.Slugs.MODERATOR]

export interface OverdueReport {
  id: number
  protocol_number: string
  target_type: IReview.ReportTargetType
  reason: IReview.ReportReason
  due_at: Date
}

export interface NoticeRecipient {
  id: number
  email: string
}

/**
 * The deadlines of the report queue — ADR-0027.
 *
 * Kept apart from the report repository on purpose: this is a sweep across
 * every operation run by a scheduled command, not a read done on behalf of a
 * moderator, and its one write — the notice marker — has a concurrency rule of
 * its own.
 */
export default class ContentReportDeadlineRepository {
  /** Operations that have at least one open report past its deadline and not yet noticed. */
  async tenantsWithUnnoticedOverdue(now: Date): Promise<Array<{ id: number; name: string }>> {
    const rows = await db
      .from('content_reports as report')
      .join('tenants as tenant', 'tenant.id', 'report.tenant_id')
      .whereIn('report.status', OPEN_STATUSES)
      .where('report.due_at', '<', now)
      .whereNull('report.sla_notified_at')
      .distinct('tenant.id', 'tenant.name')
      .orderBy('tenant.id', 'asc')

    return rows.map((row) => ({ id: Number(row.id), name: String(row.name) }))
  }

  /**
   * Claims the overdue reports of one operation for a notice.
   *
   * One `UPDATE … WHERE sla_notified_at IS NULL … RETURNING`, never a read
   * followed by a write. Two runs racing for the same rows serialise on the
   * row lock, and the second re-evaluates the predicate once the first
   * commits, finds the marker set and claims nothing — so each report is in at
   * most one notice. The claimed rows are exactly the ones this run notifies.
   */
  async claimOverdue(
    tenantId: number,
    now: Date,
    client: TransactionClientContract
  ): Promise<OverdueReport[]> {
    const result = await client.rawQuery(
      `
      UPDATE content_reports
         SET sla_notified_at = ?, updated_at = ?
       WHERE tenant_id = ?
         AND status = ANY(?)
         AND due_at < ?
         AND sla_notified_at IS NULL
      RETURNING id, protocol_number, target_type, reason, due_at
      `,
      [now, now, tenantId, OPEN_STATUSES, now]
    )

    return (result.rows as Array<Record<string, unknown>>)
      .map((row) => ({
        id: Number(row.id),
        protocol_number: String(row.protocol_number),
        target_type: row.target_type as IReview.ReportTargetType,
        reason: row.reason as IReview.ReportReason,
        due_at: new Date(row.due_at as string),
      }))
      .sort((left, right) => left.due_at.getTime() - right.due_at.getTime())
  }

  /**
   * Gives a claim back when its notice could not be sent.
   *
   * Only rows still carrying this run's marker are released, so a claim made
   * by another run in the meantime is never undone.
   */
  async releaseClaim(ids: number[], claimedAt: Date): Promise<void> {
    if (ids.length === 0) return
    await db
      .from('content_reports')
      .whereIn('id', ids)
      .where('sla_notified_at', claimedAt)
      .update({ sla_notified_at: null })
  }

  /** Every open report of the operation past its deadline, noticed or not. */
  async countOverdue(tenantId: number, now: Date): Promise<number> {
    const row = await db
      .from('content_reports')
      .where('tenant_id', tenantId)
      .whereIn('status', OPEN_STATUSES)
      .where('due_at', '<', now)
      .count('* as total')
      .first()

    return Number(row?.total ?? 0)
  }

  /**
   * Who can act on the operation's queue: platform staff who are members of
   * it, whose account is live and who are not banned there. Staff of other
   * operations are not told about this one.
   */
  async recipients(tenantId: number): Promise<NoticeRecipient[]> {
    const rows = await db
      .from('users as person')
      .join('user_tenants as membership', 'membership.user_id', 'person.id')
      .join('user_roles as assignment', 'assignment.user_id', 'person.id')
      .join('roles as role', 'role.id', 'assignment.role_id')
      .where('membership.tenant_id', tenantId)
      .whereNull('membership.banned_at')
      .where('person.is_deleted', false)
      .whereIn('role.slug', STAFF_ROLES)
      .distinct('person.id', 'person.email')
      .orderBy('person.id', 'asc')

    return rows.map((row) => ({ id: Number(row.id), email: String(row.email) }))
  }
}
