import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DateTime } from 'luxon'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import OrganizationInvitation from '#modules/organizations/models/organization_invitation'

export default class OrganizationInvitationRepository {
  async listByOrganization(
    tenantId: number,
    organizationId: number
  ): Promise<OrganizationInvitation[]> {
    return OrganizationInvitation.query()
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .preload('inviter')
      .orderBy('created_at', 'desc')
  }

  async findByIdForOrganization(
    tenantId: number,
    organizationId: number,
    id: number,
    client?: TransactionClientContract,
    forUpdate = false
  ): Promise<OrganizationInvitation | null> {
    const query = OrganizationInvitation.query({ client })
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .where('id', id)

    if (forUpdate) {
      query.forUpdate()
    }

    return query.first()
  }

  async findByTokenHashForUpdate(
    tokenHash: string,
    client: TransactionClientContract
  ): Promise<OrganizationInvitation | null> {
    return OrganizationInvitation.query({ client })
      .where('token_hash', tokenHash)
      .forUpdate()
      .first()
  }

  async listOpenByEmailForUpdate(
    tenantId: number,
    organizationId: number,
    email: string,
    client: TransactionClientContract
  ): Promise<OrganizationInvitation[]> {
    return OrganizationInvitation.query({ client })
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .whereRaw('lower(email) = ?', [email])
      .whereNull('accepted_at')
      .whereNull('revoked_at')
      .orderBy('id', 'asc')
      .forUpdate()
  }

  async create(
    data: {
      tenant_id: number
      organization_id: number
      email: string
      role: IOrganization.Role
      token_hash: string
      invited_by: number
      expires_at: DateTime
    },
    client: TransactionClientContract
  ): Promise<OrganizationInvitation> {
    return OrganizationInvitation.create(data, { client })
  }
}
