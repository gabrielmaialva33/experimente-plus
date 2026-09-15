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

  async paginateForTenant(
    tenantId: number,
    query: IReview.ListReportsQuery
  ) {
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
}
