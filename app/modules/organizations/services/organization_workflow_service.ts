import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import Organization from '#modules/organizations/models/organization'
import OrganizationRepository from '#modules/organizations/repositories/organization_repository'
import OrganizationAuditService from '#modules/organizations/services/organization_audit_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import type User from '#modules/users/models/user'

@inject()
export default class OrganizationWorkflowService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private policy: OrganizationPolicyService,
    private audit: OrganizationAuditService
  ) {}

  async listForReview(
    tenantId: number,
    actor: User,
    status?: IOrganization.Status
  ): Promise<Organization[]> {
    await this.policy.requirePlatformModerator(actor)
    return this.organizationRepository.listForTenant(tenantId, status)
  }

  async submit(tenantId: number, id: number, actor: User): Promise<Organization> {
    await db.transaction(async (client) => {
      const organization = await this.getLockedOrFail(tenantId, id, client)
      await this.policy.authorizeSubmit(actor, tenantId, id, client)

      if (!['draft', 'changes_requested'].includes(organization.status)) {
        throw new BadRequestException(
          'Only draft or changes-requested organizations may be submitted'
        )
      }

      organization.status = 'pending_review'
      organization.submitted_at = DateTime.now()
      organization.reviewed_by = null
      organization.reviewed_at = null
      organization.review_notes = null
      await organization.save()
    })

    return this.finishTransition(tenantId, id, actor, IPermission.Actions.SUBMIT)
  }

  async approve(tenantId: number, id: number, actor: User, reason: string): Promise<Organization> {
    await this.policy.requirePlatformModerator(actor)
    const reviewReason = this.requireReason(reason)

    await db.transaction(async (client) => {
      const organization = await this.getLockedOrFail(tenantId, id, client)
      this.ensureStatus(organization, ['pending_review'])

      organization.status = 'active'
      organization.reviewed_by = actor.id
      organization.reviewed_at = DateTime.now()
      organization.review_notes = reviewReason
      organization.suspended_at = null
      await organization.save()
    })

    return this.finishTransition(tenantId, id, actor, IPermission.Actions.APPROVE)
  }

  async requestChanges(
    tenantId: number,
    id: number,
    actor: User,
    reason: string
  ): Promise<Organization> {
    await this.policy.requirePlatformModerator(actor)
    const reviewReason = this.requireReason(reason)

    await db.transaction(async (client) => {
      const organization = await this.getLockedOrFail(tenantId, id, client)
      this.ensureStatus(organization, ['pending_review'])

      organization.status = 'changes_requested'
      organization.reviewed_by = actor.id
      organization.reviewed_at = DateTime.now()
      organization.review_notes = reviewReason
      await organization.save()
    })

    return this.finishTransition(tenantId, id, actor, IPermission.Actions.REQUEST_CHANGES)
  }

  async reject(tenantId: number, id: number, actor: User, reason: string): Promise<Organization> {
    await this.policy.requirePlatformModerator(actor)
    const reviewReason = this.requireReason(reason)

    await db.transaction(async (client) => {
      const organization = await this.getLockedOrFail(tenantId, id, client)
      this.ensureStatus(organization, ['pending_review'])

      organization.status = 'rejected'
      organization.reviewed_by = actor.id
      organization.reviewed_at = DateTime.now()
      organization.review_notes = reviewReason
      await organization.save()
    })

    return this.finishTransition(tenantId, id, actor, IPermission.Actions.REJECT)
  }

  async suspend(tenantId: number, id: number, actor: User, reason: string): Promise<Organization> {
    await this.policy.requirePlatformModerator(actor)
    const reviewReason = this.requireReason(reason)

    await db.transaction(async (client) => {
      const organization = await this.getLockedOrFail(tenantId, id, client)
      this.ensureStatus(organization, ['active'])

      organization.status = 'suspended'
      organization.suspended_at = DateTime.now()
      organization.reviewed_by = actor.id
      organization.reviewed_at = DateTime.now()
      organization.review_notes = reviewReason
      await organization.save()
    })

    return this.finishTransition(tenantId, id, actor, IPermission.Actions.SUSPEND)
  }

  async restore(tenantId: number, id: number, actor: User, reason: string): Promise<Organization> {
    await this.policy.requirePlatformModerator(actor)
    const reviewReason = this.requireReason(reason)

    await db.transaction(async (client) => {
      const organization = await this.getLockedOrFail(tenantId, id, client)
      this.ensureStatus(organization, ['suspended'])

      organization.status = 'active'
      organization.suspended_at = null
      organization.reviewed_by = actor.id
      organization.reviewed_at = DateTime.now()
      organization.review_notes = reviewReason
      await organization.save()
    })

    return this.finishTransition(tenantId, id, actor, IPermission.Actions.RESTORE)
  }

  async archive(tenantId: number, id: number, actor: User, reason: string): Promise<Organization> {
    const reviewReason = this.requireReason(reason)

    await db.transaction(async (client) => {
      const organization = await this.getLockedOrFail(tenantId, id, client)

      if (['draft', 'changes_requested'].includes(organization.status)) {
        await this.policy.authorizeArchiveDraft(actor, tenantId, id, client)
      } else if (['active', 'suspended'].includes(organization.status)) {
        await this.policy.requirePlatformAdmin(actor)
      } else {
        throw new BadRequestException(
          `Organization cannot be archived while ${organization.status}`
        )
      }

      organization.status = 'archived'
      organization.archived_at = DateTime.now()
      organization.reviewed_by = actor.id
      organization.reviewed_at = DateTime.now()
      organization.review_notes = reviewReason
      await organization.save()
    })

    return this.finishTransition(tenantId, id, actor, IPermission.Actions.ARCHIVE)
  }

  private async getLockedOrFail(
    tenantId: number,
    id: number,
    client: Parameters<OrganizationRepository['findByIdForTenant']>[2]
  ): Promise<Organization> {
    const organization = await this.organizationRepository.findByIdForTenant(
      tenantId,
      id,
      client,
      true
    )
    if (!organization) {
      throw new NotFoundException('Organization not found')
    }
    return organization
  }

  private ensureStatus(organization: Organization, expected: IOrganization.Status[]): void {
    if (!expected.includes(organization.status)) {
      throw new BadRequestException(
        `Organization must be ${expected.join(' or ')} to perform this transition`
      )
    }
  }

  private requireReason(reason: string): string {
    const normalized = reason?.trim()
    if (!normalized) {
      throw new BadRequestException('A decision reason is required')
    }
    return normalized
  }

  private async finishTransition(
    tenantId: number,
    id: number,
    actor: User,
    action: IPermission.Actions
  ): Promise<Organization> {
    const organization = await this.organizationRepository.findByIdForTenant(tenantId, id)
    if (!organization) {
      throw new NotFoundException('Organization not found')
    }

    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATIONS,
      action,
      resourceId: organization.id,
      metadata: { status: organization.status },
    })

    return organization
  }
}
