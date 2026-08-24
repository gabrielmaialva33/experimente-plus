import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import Organization from '#modules/organizations/models/organization'
import OrganizationClaim from '#modules/organizations/models/organization_claim'
import OrganizationClaimRepository from '#modules/organizations/repositories/organization_claim_repository'
import OrganizationMemberRepository from '#modules/organizations/repositories/organization_member_repository'
import OrganizationRepository from '#modules/organizations/repositories/organization_repository'
import OrganizationAuditService from '#modules/organizations/services/organization_audit_service'
import OrganizationMembershipService from '#modules/organizations/services/organization_membership_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import type User from '#modules/users/models/user'

@inject()
export default class OrganizationClaimService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private claimRepository: OrganizationClaimRepository,
    private memberRepository: OrganizationMemberRepository,
    private membershipService: OrganizationMembershipService,
    private policy: OrganizationPolicyService,
    private audit: OrganizationAuditService
  ) {}

  async create(
    tenantId: number,
    organizationId: number,
    actor: User,
    payload: IOrganization.ClaimPayload
  ): Promise<OrganizationClaim> {
    const claimId = await db.transaction(async (client) => {
      const organization = await this.organizationRepository.findByIdForTenant(
        tenantId,
        organizationId,
        client,
        true
      )
      if (!organization) {
        throw new NotFoundException('Organization not found')
      }
      this.ensureClaimableOrganization(organization)

      const members = await this.memberRepository.lockAllForOrganization(
        tenantId,
        organizationId,
        client
      )
      const currentMembership = members.find((member) => member.user_id === actor.id)
      if (currentMembership && currentMembership.status !== 'removed') {
        throw new BadRequestException('Organization members cannot create a claim')
      }
      if (members.some((member) => member.role === 'owner' && member.status === 'active')) {
        throw new BadRequestException('Organization already has an active owner')
      }
      if (
        await this.claimRepository.findPendingByClaimant(tenantId, organizationId, actor.id, client)
      ) {
        throw new BadRequestException('A pending claim already exists for this organization')
      }

      const claim = await this.claimRepository.create(
        {
          tenant_id: tenantId,
          organization_id: organizationId,
          claimant_id: actor.id,
          status: 'pending',
          message: this.nullableText(payload.message),
          evidence: payload.evidence ?? null,
        },
        client
      )
      return claim.id
    })

    const claim = await this.getClaimOrFail(tenantId, claimId)
    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATION_CLAIMS,
      action: IPermission.Actions.CREATE,
      resourceId: claim.id,
      metadata: { organization_id: organizationId, status: claim.status },
    })
    return claim
  }

  async listForReview(
    tenantId: number,
    actor: User,
    status?: IOrganization.ClaimStatus
  ): Promise<OrganizationClaim[]> {
    await this.policy.requirePlatformModerator(actor)
    return this.claimRepository.listForReview(tenantId, status)
  }

  async approve(
    tenantId: number,
    claimId: number,
    actor: User,
    reason: string
  ): Promise<OrganizationClaim> {
    await this.policy.requirePlatformModerator(actor)
    const reviewReason = this.requireReason(reason)

    await db.transaction(async (client) => {
      const claim = await this.claimRepository.findByIdForTenant(tenantId, claimId, client, true)
      if (!claim) {
        throw new NotFoundException('Organization claim not found')
      }
      this.ensurePending(claim)

      const organization = await this.organizationRepository.findByIdForTenant(
        tenantId,
        claim.organization_id,
        client,
        true
      )
      if (!organization) {
        throw new NotFoundException('Organization not found')
      }
      this.ensureClaimableOrganization(organization)

      const members = await this.memberRepository.lockAllForOrganization(
        tenantId,
        claim.organization_id,
        client
      )
      if (members.some((member) => member.role === 'owner' && member.status === 'active')) {
        throw new BadRequestException('Organization already has an active owner')
      }

      await this.membershipService.activateOrCreateMember({
        tenantId,
        organizationId: claim.organization_id,
        userId: claim.claimant_id,
        role: 'owner',
        invitedBy: null,
        allowSuspendedReactivation: true,
        client,
      })

      const reviewedAt = DateTime.now()
      claim.status = 'approved'
      claim.reviewed_by = actor.id
      claim.reviewed_at = reviewedAt
      claim.review_notes = reviewReason
      await claim.save()

      const competitors = await this.claimRepository.listPendingCompetitorsForUpdate(
        tenantId,
        claim.organization_id,
        claim.id,
        client
      )
      for (const competitor of competitors) {
        competitor.status = 'rejected'
        competitor.reviewed_by = actor.id
        competitor.reviewed_at = reviewedAt
        competitor.review_notes = 'Another claim for this organization was approved'
        await competitor.save()
      }
    })

    const claim = await this.getClaimOrFail(tenantId, claimId)
    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATION_CLAIMS,
      action: IPermission.Actions.APPROVE,
      resourceId: claim.id,
      metadata: { organization_id: claim.organization_id, status: claim.status },
    })
    return claim
  }

  async reject(
    tenantId: number,
    claimId: number,
    actor: User,
    reason: string
  ): Promise<OrganizationClaim> {
    await this.policy.requirePlatformModerator(actor)
    const reviewReason = this.requireReason(reason)

    await db.transaction(async (client) => {
      const claim = await this.claimRepository.findByIdForTenant(tenantId, claimId, client, true)
      if (!claim) {
        throw new NotFoundException('Organization claim not found')
      }
      this.ensurePending(claim)

      claim.status = 'rejected'
      claim.reviewed_by = actor.id
      claim.reviewed_at = DateTime.now()
      claim.review_notes = reviewReason
      await claim.save()
    })

    const claim = await this.getClaimOrFail(tenantId, claimId)
    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATION_CLAIMS,
      action: IPermission.Actions.REJECT,
      resourceId: claim.id,
      metadata: { organization_id: claim.organization_id, status: claim.status },
    })
    return claim
  }

  private ensureClaimableOrganization(organization: Organization): void {
    if (['rejected', 'archived'].includes(organization.status)) {
      throw new BadRequestException(`Organization cannot be claimed while ${organization.status}`)
    }
  }

  private ensurePending(claim: OrganizationClaim): void {
    if (claim.status !== 'pending') {
      throw new BadRequestException('Only pending organization claims may be reviewed')
    }
  }

  private async getClaimOrFail(tenantId: number, claimId: number): Promise<OrganizationClaim> {
    const claim = await this.claimRepository.findByIdForTenant(tenantId, claimId)
    if (!claim) {
      throw new NotFoundException('Organization claim not found')
    }
    await claim.load('organization')
    await claim.load('claimant')
    return claim
  }

  private requireReason(reason: string): string {
    const normalized = reason?.trim()
    if (!normalized) {
      throw new BadRequestException('A claim review reason is required')
    }
    return normalized
  }

  private nullableText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized ? normalized : null
  }
}
