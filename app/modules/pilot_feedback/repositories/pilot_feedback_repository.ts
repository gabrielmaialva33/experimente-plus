import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import Establishment from '#modules/establishments/models/establishment'
import Organization from '#modules/organizations/models/organization'
import type IPilotFeedback from '#modules/pilot_feedback/interfaces/pilot_feedback_interface'
import PilotFeedback from '#modules/pilot_feedback/models/pilot_feedback'
import User from '#modules/users/models/user'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class PilotFeedbackRepository extends LucidRepository<typeof PilotFeedback> {
  constructor() {
    super(PilotFeedback)
  }

  async paginateForTenant(tenantId: number, query: IPilotFeedback.ListQuery) {
    const rows = PilotFeedback.query()
      .where('tenant_id', tenantId)
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

    const paginator = await rows.paginate(query.page, query.per_page)
    await this.loadPageRelations(tenantId, paginator.all())
    return paginator
  }

  private async loadPageRelations(tenantId: number, feedback: PilotFeedback[]): Promise<void> {
    await this.loadUsers(feedback)
    await this.loadOrganizations(tenantId, feedback)
    await this.loadEstablishments(tenantId, feedback)
  }

  private async loadUsers(feedback: PilotFeedback[]): Promise<void> {
    const userIds = this.uniqueIds(feedback.flatMap((item) => [item.user_id, item.reviewed_by]))
    const users = userIds.length === 0 ? [] : await User.query().whereIn('id', userIds)
    const usersById = new Map(users.map((user) => [user.id, user]))

    for (const item of feedback) {
      item.$setRelated('author', usersById.get(item.user_id) ?? null)
      item.$setRelated(
        'reviewer',
        item.reviewed_by === null ? null : (usersById.get(item.reviewed_by) ?? null)
      )
    }
  }

  private async loadOrganizations(tenantId: number, feedback: PilotFeedback[]): Promise<void> {
    const organizationIds = this.uniqueIds(feedback.map((item) => item.organization_id))
    const organizations =
      organizationIds.length === 0
        ? []
        : await Organization.query().where('tenant_id', tenantId).whereIn('id', organizationIds)
    const organizationsById = new Map(
      organizations.map((organization) => [organization.id, organization])
    )

    for (const item of feedback) {
      item.$setRelated(
        'organization',
        item.organization_id === null ? null : (organizationsById.get(item.organization_id) ?? null)
      )
    }
  }

  private async loadEstablishments(tenantId: number, feedback: PilotFeedback[]): Promise<void> {
    const establishmentIds = this.uniqueIds(feedback.map((item) => item.establishment_id))
    const establishments =
      establishmentIds.length === 0
        ? []
        : await Establishment.query()
            .where('tenant_id', tenantId)
            .whereIn('id', establishmentIds)
            .preload('revisions', (revisionQuery) =>
              revisionQuery.orderBy('version', 'desc').limit(1)
            )
    const establishmentsById = new Map(
      establishments.map((establishment) => [establishment.id, establishment])
    )

    for (const item of feedback) {
      item.$setRelated(
        'establishment',
        item.establishment_id === null
          ? null
          : (establishmentsById.get(item.establishment_id) ?? null)
      )
    }
  }

  private uniqueIds(ids: Array<number | null>): number[] {
    return [...new Set(ids.filter((id): id is number => id !== null))]
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
