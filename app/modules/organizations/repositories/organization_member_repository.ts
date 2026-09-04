import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import OrganizationMember from '#modules/organizations/models/organization_member'

export default class OrganizationMemberRepository {
  async listActiveByUser(tenantId: number, userId: number): Promise<OrganizationMember[]> {
    return OrganizationMember.query()
      .where('tenant_id', tenantId)
      .where('user_id', userId)
      .where('status', 'active')
      .orderBy('organization_id', 'asc')
  }

  async listByOrganization(
    tenantId: number,
    organizationId: number
  ): Promise<OrganizationMember[]> {
    return OrganizationMember.query()
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .preload('user')
      .orderByRaw(
        "CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END"
      )
      .orderBy('id', 'asc')
  }

  async findActiveByUser(
    tenantId: number,
    organizationId: number,
    userId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    return OrganizationMember.query({ client })
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .where('user_id', userId)
      .where('status', 'active')
      .first()
  }

  async findByIdForOrganization(
    tenantId: number,
    organizationId: number,
    id: number,
    client?: TransactionClientContract,
    forUpdate = false
  ): Promise<OrganizationMember | null> {
    const query = OrganizationMember.query({ client })
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .where('id', id)

    if (forUpdate) {
      query.forUpdate()
    }

    return query.first()
  }

  async findByUser(
    tenantId: number,
    organizationId: number,
    userId: number,
    client?: TransactionClientContract,
    forUpdate = false
  ): Promise<OrganizationMember | null> {
    const query = OrganizationMember.query({ client })
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .where('user_id', userId)

    if (forUpdate) {
      query.forUpdate()
    }

    return query.first()
  }

  async lockAllForOrganization(
    tenantId: number,
    organizationId: number,
    client: TransactionClientContract
  ): Promise<OrganizationMember[]> {
    return OrganizationMember.query({ client })
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .orderBy('id', 'asc')
      .forUpdate()
  }

  async create(
    data: {
      tenant_id: number
      organization_id: number
      user_id: number
      role: IOrganization.Role
      status: IOrganization.MemberStatus
      invited_by: number | null
    },
    client: TransactionClientContract
  ): Promise<OrganizationMember> {
    return OrganizationMember.create(data, { client })
  }

  async ensureTenantMembership(
    tenantId: number,
    userId: number,
    client: TransactionClientContract
  ): Promise<void> {
    const now = new Date()
    await client
      .table('user_tenants')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        role: 'member',
        created_at: now,
        updated_at: now,
      })
      .onConflict(['user_id', 'tenant_id'])
      .ignore()
  }
}
