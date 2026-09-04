import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import Establishment from '#modules/establishments/models/establishment'
import LucidRepository from '#shared/lucid/lucid_repository'

const OPEN_REVISION_STATUSES = ['draft', 'pending_review', 'changes_requested'] as const

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

  /**
   * Loads the Portal overview projection in a fixed set of relation queries.
   * The organization ids must come from an authorization-aware service and the
   * tenant predicate remains mandatory so the batch fails closed at the query boundary.
   */
  async listForAuthorizedOrganizations(
    tenantId: number,
    organizationIds: readonly number[]
  ): Promise<Establishment[]> {
    const scopedOrganizationIds = [...new Set(organizationIds)]
    if (scopedOrganizationIds.length === 0) {
      return []
    }

    return Establishment.query()
      .where('tenant_id', tenantId)
      .whereIn('organization_id', scopedOrganizationIds)
      .preload('published_revision', (query) => {
        query.where('tenant_id', tenantId)
        this.preloadCompletenessAggregate(query, tenantId)
      })
      .preload('revisions', (query) => {
        query
          .where('tenant_id', tenantId)
          .whereIn('status', [...OPEN_REVISION_STATUSES])
          .orderBy('version', 'desc')
          .orderBy('id', 'desc')
        this.preloadCompletenessAggregate(query, tenantId)
      })
      .orderBy('organization_id', 'asc')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
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

  private preloadCompletenessAggregate(query: any, tenantId: number): void {
    query
      .preload('address', (addressQuery: any) => addressQuery.where('tenant_id', tenantId))
      .preload('hours', (hoursQuery: any) => hoursQuery.where('tenant_id', tenantId))
      .preload('categories', (categoryQuery: any) => {
        categoryQuery
          .where('tenant_id', tenantId)
          .preload('category', (relatedCategoryQuery: any) =>
            relatedCategoryQuery.where('tenant_id', tenantId)
          )
      })
      .preload('attribute_values', (valueQuery: any) => {
        valueQuery
          .where('tenant_id', tenantId)
          .preload('selected_options', (selectedOptionQuery: any) =>
            selectedOptionQuery.where('tenant_id', tenantId)
          )
      })
      .preload('media', (mediaQuery: any) => mediaQuery.where('tenant_id', tenantId))
  }
}
