import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import Organization from '#modules/organizations/models/organization'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'

export default class OrganizationRepository {
  async listForUser(tenantId: number, userId: number): Promise<Organization[]> {
    return Organization.query()
      .where('tenant_id', tenantId)
      .whereHas('members', (query) => {
        query.where('user_id', userId).where('status', 'active')
      })
      .preload('members', (query) => {
        query.where('user_id', userId).where('status', 'active')
      })
      .orderBy('trade_name', 'asc')
  }

  async listForTenant(tenantId: number, status?: IOrganization.Status): Promise<Organization[]> {
    const query = Organization.query()
      .where('tenant_id', tenantId)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')

    if (status) {
      query.where('status', status)
    }

    return query
  }

  async listByIdsForTenant(tenantId: number, ids: readonly number[]): Promise<Organization[]> {
    const scopedIds = [...new Set(ids)]
    if (scopedIds.length === 0) {
      return []
    }

    return Organization.query()
      .where('tenant_id', tenantId)
      .whereIn('id', scopedIds)
      .orderBy('trade_name', 'asc')
      .orderBy('id', 'asc')
  }

  async findByIdForTenant(
    tenantId: number,
    id: number,
    client?: TransactionClientContract,
    forUpdate = false
  ): Promise<Organization | null> {
    const query = Organization.query({ client }).where('tenant_id', tenantId).where('id', id)

    if (forUpdate) {
      query.forUpdate()
    }

    return query.first()
  }

  async isSlugTaken(
    tenantId: number,
    slug: string,
    excludeId?: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    const query = Organization.query({ client }).where('tenant_id', tenantId).where('slug', slug)

    if (excludeId !== undefined) {
      query.whereNot('id', excludeId)
    }

    return Boolean(await query.first())
  }

  async isTaxIdTaken(
    tenantId: number,
    taxId: string,
    excludeId?: number,
    client?: TransactionClientContract
  ): Promise<boolean> {
    const query = Organization.query({ client }).where('tenant_id', tenantId).where('tax_id', taxId)

    if (excludeId !== undefined) {
      query.whereNot('id', excludeId)
    }

    return Boolean(await query.first())
  }

  async create(
    data: {
      tenant_id: number
      legal_name: string
      trade_name: string
      slug: string
      tax_id: string
      email: string
      phone: string
      website: string | null
      status: IOrganization.Status
      created_by: number | null
    },
    client: TransactionClientContract
  ): Promise<Organization> {
    return Organization.create(data, { client })
  }
}
