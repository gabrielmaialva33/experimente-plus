import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import OrganizationClaim from '#modules/organizations/models/organization_claim'

export default class OrganizationClaimRepository {
  async listForReview(
    tenantId: number,
    status?: IOrganization.ClaimStatus
  ): Promise<OrganizationClaim[]> {
    const query = OrganizationClaim.query()
      .where('tenant_id', tenantId)
      .preload('organization')
      .preload('claimant')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')

    if (status) {
      query.where('status', status)
    }

    return query
  }

  async findByIdForTenant(
    tenantId: number,
    id: number,
    client?: TransactionClientContract,
    forUpdate = false
  ): Promise<OrganizationClaim | null> {
    const query = OrganizationClaim.query({ client }).where('tenant_id', tenantId).where('id', id)

    if (forUpdate) {
      query.forUpdate()
    }

    return query.first()
  }

  async findPendingByClaimant(
    tenantId: number,
    organizationId: number,
    claimantId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationClaim | null> {
    return OrganizationClaim.query({ client })
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .where('claimant_id', claimantId)
      .where('status', 'pending')
      .first()
  }

  async listPendingCompetitorsForUpdate(
    tenantId: number,
    organizationId: number,
    approvedClaimId: number,
    client: TransactionClientContract
  ): Promise<OrganizationClaim[]> {
    return OrganizationClaim.query({ client })
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .where('status', 'pending')
      .whereNot('id', approvedClaimId)
      .orderBy('id', 'asc')
      .forUpdate()
  }

  async create(
    data: {
      tenant_id: number
      organization_id: number
      claimant_id: number
      status: IOrganization.ClaimStatus
      message: string | null
      evidence: IOrganization.ClaimEvidence | null
    },
    client: TransactionClientContract
  ): Promise<OrganizationClaim> {
    return OrganizationClaim.create(data, { client })
  }
}
