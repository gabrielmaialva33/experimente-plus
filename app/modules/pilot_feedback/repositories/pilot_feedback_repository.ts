import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IPilotFeedback from '#modules/pilot_feedback/interfaces/pilot_feedback_interface'
import PilotFeedback from '#modules/pilot_feedback/models/pilot_feedback'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class PilotFeedbackRepository extends LucidRepository<typeof PilotFeedback> {
  constructor() {
    super(PilotFeedback)
  }

  async paginateForTenant(tenantId: number, query: IPilotFeedback.ListQuery) {
    const rows = PilotFeedback.query()
      .where('tenant_id', tenantId)
      .preload('author')
      .preload('reviewer')
      .preload('organization')
      .preload('establishment', (establishmentQuery) =>
        establishmentQuery.preload('revisions', (revisionQuery) =>
          revisionQuery.orderBy('version', 'desc').limit(1)
        )
      )
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    if (query.status !== undefined) {
      rows.where('status', query.status)
    }
    if (query.context !== undefined) {
      rows.where('context', query.context)
    }
    if (query.organization_id !== undefined) {
      rows.where('organization_id', query.organization_id)
    }
    if (query.establishment_id !== undefined) {
      rows.where('establishment_id', query.establishment_id)
    }

    return rows.paginate(query.page, query.per_page)
  }

  async findLocked(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<PilotFeedback | null> {
    return PilotFeedback.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .forUpdate()
      .first()
  }
}
