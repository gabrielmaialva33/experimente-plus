import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import Establishment from '#modules/establishments/models/establishment'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class EstablishmentRepository extends LucidRepository<typeof Establishment> {
  constructor() {
    super(Establishment)
  }

  async listForOrganization(tenantId: number, organizationId: number): Promise<Establishment[]> {
    return Establishment.query()
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .preload('published_revision')
      .preload('revisions', (query) => {
        query
          .whereIn('status', ['draft', 'pending_review', 'changes_requested'])
          .orderBy('version', 'desc')
          .limit(1)
      })
      .orderBy('created_at', 'desc')
  }

  async listByOrganization(tenantId: number, organizationId: number): Promise<Establishment[]> {
    return this.listForOrganization(tenantId, organizationId)
  }

  async findByIdForTenant(tenantId: number, id: number): Promise<Establishment | null> {
    return Establishment.query().where('tenant_id', tenantId).where('id', id).first()
  }

  async findByIdForTenantWithDetails(tenantId: number, id: number): Promise<Establishment | null> {
    return Establishment.query()
      .where('tenant_id', tenantId)
      .where('id', id)
      .preload('organization')
      .preload('published_revision', (query) => this.preloadRevisionAggregate(query))
      .preload('revisions', (query) => {
        query
          .whereIn('status', ['draft', 'pending_review', 'changes_requested'])
          .orderBy('version', 'desc')
          .limit(1)
        this.preloadRevisionAggregate(query)
      })
      .first()
  }

  async findLocked(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<Establishment | null> {
    return Establishment.query({ client })
      .where('tenant_id', tenantId)
      .where('id', id)
      .forUpdate()
      .first()
  }

  async lockByIdForTenant(
    tenantId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<Establishment | null> {
    return this.findLocked(tenantId, id, client)
  }

  private preloadRevisionAggregate(query: any): void {
    query
      .preload('city')
      .preload('address')
      .preload('hours')
      .preload('special_days', (specialDayQuery: any) => specialDayQuery.preload('intervals'))
      .preload('categories', (categoryQuery: any) => categoryQuery.preload('category'))
      .preload('attribute_values', (valueQuery: any) => {
        valueQuery.preload('definition')
        valueQuery.preload('selected_options', (optionQuery: any) => optionQuery.preload('option'))
      })
  }
}
