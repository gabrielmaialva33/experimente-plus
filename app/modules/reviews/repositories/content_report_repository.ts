import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IReview from '#modules/reviews/interfaces/review_interface'
import ContentReport from '#modules/reviews/models/content_report'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class ContentReportRepository extends LucidRepository<typeof ContentReport> {
  constructor() {
    super(ContentReport)
  }

  async findById(
    tenantId: number,
    id: number,
    client?: TransactionClientContract,
    lock = false
  ): Promise<ContentReport | null> {
    const query = ContentReport.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .preload('reporter', (userQuery) => {
        userQuery.select('id', 'full_name', 'email')
      })
      .preload('resolver', (userQuery) => {
        userQuery.select('id', 'full_name', 'email')
      })

    if (lock) {
      query.forUpdate()
    }

    return query.first()
  }

  async findByTargetAndReporter(
    tenantId: number,
    targetType: IReview.ReportTargetType,
    targetId: number,
    reporterId: number,
    client?: TransactionClientContract
  ): Promise<ContentReport | null> {
    return ContentReport.query({ client })
      .where('tenant_id', tenantId)
      .where('target_type', targetType)
      .where('target_id', targetId)
      .where('reporter_id', reporterId)
      .first()
  }

  /**
   * The open automatic report of a target, locked for the caller's
   * transaction. There is at most one per target.
   */
  async findOpenAutomaticForUpdate(
    tenantId: number,
    targetType: IReview.ReportTargetType,
    targetId: number,
    client: TransactionClientContract
  ): Promise<ContentReport | null> {
    return ContentReport.query({ client })
      .where('tenant_id', tenantId)
      .where('target_type', targetType)
      .where('target_id', targetId)
      .where('origin', 'automatic')
      .whereIn('status', ['pending', 'under_review'])
      .forUpdate()
      .first()
  }

  /** Whether another report of the target was resolved by hiding the content. */
  async hasOtherHiddenResolution(
    tenantId: number,
    targetType: IReview.ReportTargetType,
    targetId: number,
    excludeReportId: number,
    client: TransactionClientContract
  ): Promise<boolean> {
    const hiddenByPerson = await client
      .from('content_reports')
      .where('tenant_id', tenantId)
      .where('target_type', targetType)
      .where('target_id', targetId)
      .whereNot('id', excludeReportId)
      .where('resolution_action', 'content_hidden')
      .first()

    return Boolean(hiddenByPerson)
  }

  async paginateForTenant(tenantId: number, query: IReview.ListReportsQuery) {
    const rows = ContentReport.query()
      .where('tenant_id', tenantId)
      .preload('reporter', (userQuery) => {
        userQuery.select('id', 'full_name', 'email')
      })
      .preload('resolver', (userQuery) => {
        userQuery.select('id', 'full_name', 'email')
      })
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    if (query.status !== undefined) {
      rows.where('status', query.status)
    }
    if (query.target_type !== undefined) {
      rows.where('target_type', query.target_type)
    }

    const page = query.page ?? 1
    const perPage = query.per_page ?? 10
    return rows.paginate(page, perPage)
  }

  /**
   * An earlier anonymous report of the same target from the same origin —
   * ADR-0027 scenario 14. Either hash matching is a repeat: a token survives a
   * change of network, an address survives a reinstall.
   */
  async findAnonymousRepeat(
    tenantId: number,
    targetType: IReview.ReportTargetType,
    targetId: number,
    ipHash: string,
    tokenHash: string | null,
    client?: TransactionClientContract
  ): Promise<ContentReport | null> {
    return ContentReport.query({ client })
      .where('tenant_id', tenantId)
      .where('target_type', targetType)
      .where('target_id', targetId)
      .whereNull('reporter_id')
      .where((origin) => {
        origin.where('reporter_ip_hash', ipHash)
        if (tokenHash) origin.orWhere('reporter_token_hash', tokenHash)
      })
      .first()
  }
}
