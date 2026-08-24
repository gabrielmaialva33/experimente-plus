import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRepository from '#modules/establishments/repositories/establishment_repository'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import User from '#modules/users/models/user'

@inject()
export default class EstablishmentAccessService {
  constructor(
    private establishmentRepository: EstablishmentRepository,
    private revisionRepository: EstablishmentRevisionRepository,
    private organizationPolicy: OrganizationPolicyService
  ) {}

  async authorizeRead(
    actor: User,
    tenantId: number,
    establishmentId: number
  ): Promise<Establishment> {
    const establishment = await this.establishmentRepository.findByIdForTenant(
      tenantId,
      establishmentId
    )
    if (!establishment) {
      throw new NotFoundException('Establishment not found')
    }

    await this.organizationPolicy.authorizeRead(actor, tenantId, establishment.organization_id)
    return establishment
  }

  async authorizeManage(
    actor: User,
    tenantId: number,
    establishmentId: number,
    client?: TransactionClientContract
  ): Promise<Establishment> {
    const establishment = client
      ? await this.establishmentRepository.findLocked(tenantId, establishmentId, client)
      : await this.establishmentRepository.findByIdForTenant(tenantId, establishmentId)

    if (!establishment) {
      throw new NotFoundException('Establishment not found')
    }

    await this.organizationPolicy.authorizeManageEstablishments(
      actor,
      tenantId,
      establishment.organization_id,
      client
    )
    return establishment
  }

  async getLockedEditableRevision(
    actor: User,
    tenantId: number,
    establishmentId: number,
    client: TransactionClientContract
  ): Promise<{ establishment: Establishment; revision: EstablishmentRevision }> {
    const establishment = await this.authorizeManage(actor, tenantId, establishmentId, client)
    if (establishment.lifecycle_status === 'archived') {
      throw new BadRequestException('Archived establishments cannot be edited')
    }

    const revision = await this.revisionRepository.findLockedForEstablishment(
      tenantId,
      establishmentId,
      client
    )
    if (!revision) {
      throw new NotFoundException('Open establishment revision not found')
    }
    if (!['draft', 'changes_requested'].includes(revision.status)) {
      throw new BadRequestException(`Revision cannot be edited while ${revision.status}`)
    }

    return { establishment, revision }
  }

  async getReadable(
    tenantId: number,
    establishmentId: number,
    actor: User
  ): Promise<Establishment> {
    return this.authorizeRead(actor, tenantId, establishmentId)
  }

  async getEditable(
    tenantId: number,
    establishmentId: number,
    actor: User,
    client: TransactionClientContract
  ): Promise<{ establishment: Establishment; revision: EstablishmentRevision }> {
    return this.getLockedEditableRevision(actor, tenantId, establishmentId, client)
  }

  async getForLifecycle(
    tenantId: number,
    establishmentId: number,
    actor: User,
    client: TransactionClientContract
  ): Promise<{ establishment: Establishment }> {
    const establishment = await this.authorizeManage(actor, tenantId, establishmentId, client)
    await this.organizationPolicy.authorizeManageEstablishmentLifecycle(
      actor,
      tenantId,
      establishment.organization_id,
      client
    )

    return { establishment }
  }
}
