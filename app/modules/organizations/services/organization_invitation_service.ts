import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import Organization from '#modules/organizations/models/organization'
import OrganizationInvitation from '#modules/organizations/models/organization_invitation'
import OrganizationInvitationRepository from '#modules/organizations/repositories/organization_invitation_repository'
import OrganizationMemberRepository from '#modules/organizations/repositories/organization_member_repository'
import OrganizationRepository from '#modules/organizations/repositories/organization_repository'
import OrganizationAuditService from '#modules/organizations/services/organization_audit_service'
import OrganizationInvitationNotification from '#modules/organizations/services/organization_invitation_notification'
import OrganizationInvitationTokenService from '#modules/organizations/services/organization_invitation_token_service'
import OrganizationMembershipService from '#modules/organizations/services/organization_membership_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import User from '#modules/users/models/user'

@inject()
export default class OrganizationInvitationService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private invitationRepository: OrganizationInvitationRepository,
    private memberRepository: OrganizationMemberRepository,
    private membershipService: OrganizationMembershipService,
    private tokenService: OrganizationInvitationTokenService,
    private policy: OrganizationPolicyService,
    private audit: OrganizationAuditService
  ) {}

  async list(
    tenantId: number,
    organizationId: number,
    actor: User
  ): Promise<OrganizationInvitation[]> {
    await this.getOrganizationOrFail(tenantId, organizationId)
    await this.policy.authorizeListMembers(actor, tenantId, organizationId)
    return this.invitationRepository.listByOrganization(tenantId, organizationId)
  }

  async create(
    tenantId: number,
    organizationId: number,
    actor: User,
    payload: IOrganization.InvitationPayload
  ): Promise<{ invitation: OrganizationInvitation; email_sent: boolean }> {
    const organization = await this.getOrganizationOrFail(tenantId, organizationId)
    this.ensureOrganizationAcceptsTeamChanges(organization)
    await this.policy.authorizeInviteRole(actor, tenantId, organizationId, payload.role)

    const email = payload.email.trim().toLowerCase()
    await this.ensureNotActiveMember(tenantId, organizationId, email)
    const generated = this.tokenService.generate()

    const invitationId = await db.transaction(async (client) => {
      const openInvitations = await this.invitationRepository.listOpenByEmailForUpdate(
        tenantId,
        organizationId,
        email,
        client
      )
      const revokedAt = DateTime.now()
      for (const invitation of openInvitations) {
        invitation.revoked_by = actor.id
        invitation.revoked_at = revokedAt
        await invitation.save()
      }

      const invitation = await this.invitationRepository.create(
        {
          tenant_id: tenantId,
          organization_id: organizationId,
          email,
          role: payload.role,
          token_hash: generated.tokenHash,
          invited_by: actor.id,
          expires_at: generated.expiresAt,
        },
        client
      )
      return invitation.id
    })

    const invitation = await this.getInvitationOrFail(tenantId, organizationId, invitationId)
    const emailSent = await this.sendInvitation(invitation, organization, actor, generated.token)
    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATION_INVITATIONS,
      action: IPermission.Actions.CREATE,
      resourceId: invitation.id,
      metadata: { organization_id: organizationId, role: invitation.role, email_sent: emailSent },
    })

    return { invitation, email_sent: emailSent }
  }

  async resend(
    tenantId: number,
    organizationId: number,
    invitationId: number,
    actor: User
  ): Promise<{ invitation: OrganizationInvitation; email_sent: boolean }> {
    const organization = await this.getOrganizationOrFail(tenantId, organizationId)
    this.ensureOrganizationAcceptsTeamChanges(organization)
    const current = await this.getInvitationOrFail(tenantId, organizationId, invitationId)
    await this.policy.authorizeInviteRole(actor, tenantId, organizationId, current.role)
    const generated = this.tokenService.generate()

    await db.transaction(async (client) => {
      const invitation = await this.invitationRepository.findByIdForOrganization(
        tenantId,
        organizationId,
        invitationId,
        client,
        true
      )
      if (!invitation) {
        throw new NotFoundException('Organization invitation not found')
      }
      this.ensureOpen(invitation)

      invitation.token_hash = generated.tokenHash
      invitation.expires_at = generated.expiresAt
      await invitation.save()
    })

    const invitation = await this.getInvitationOrFail(tenantId, organizationId, invitationId)
    const emailSent = await this.sendInvitation(invitation, organization, actor, generated.token)
    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATION_INVITATIONS,
      action: IPermission.Actions.RESEND,
      resourceId: invitation.id,
      metadata: { organization_id: organizationId, role: invitation.role, email_sent: emailSent },
    })

    return { invitation, email_sent: emailSent }
  }

  async revoke(
    tenantId: number,
    organizationId: number,
    invitationId: number,
    actor: User
  ): Promise<void> {
    const organization = await this.getOrganizationOrFail(tenantId, organizationId)
    const current = await this.getInvitationOrFail(tenantId, organizationId, invitationId)
    await this.policy.authorizeInviteRole(actor, tenantId, organizationId, current.role)

    await db.transaction(async (client) => {
      const invitation = await this.invitationRepository.findByIdForOrganization(
        tenantId,
        organizationId,
        invitationId,
        client,
        true
      )
      if (!invitation) {
        throw new NotFoundException('Organization invitation not found')
      }
      this.ensureOpen(invitation)

      invitation.revoked_by = actor.id
      invitation.revoked_at = DateTime.now()
      await invitation.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATION_INVITATIONS,
      action: IPermission.Actions.REVOKE,
      resourceId: invitationId,
      metadata: { organization_id: organization.id },
    })
  }

  async accept(
    token: string,
    actor: User
  ): Promise<{
    tenant_id: number
    organization: Organization
    membership_id: number
    role: IOrganization.Role
  }> {
    const tokenHash = this.tokenService.hash(token)

    const result = await db.transaction(async (client) => {
      const invitation = await this.invitationRepository.findByTokenHashForUpdate(tokenHash, client)
      if (!invitation) {
        throw new NotFoundException('Organization invitation not found')
      }

      this.ensureOpen(invitation)
      if (invitation.expires_at.toMillis() <= DateTime.now().toMillis()) {
        throw new BadRequestException('Organization invitation has expired')
      }
      if (actor.email.trim().toLowerCase() !== invitation.email) {
        throw new BadRequestException(
          'The authenticated account does not match the invitation email'
        )
      }

      const organization = await this.organizationRepository.findByIdForTenant(
        invitation.tenant_id,
        invitation.organization_id,
        client,
        true
      )
      if (!organization) {
        throw new NotFoundException('Organization not found')
      }
      this.ensureOrganizationAcceptsTeamChanges(organization)

      const membership = await this.membershipService.activateOrCreateMember({
        tenantId: invitation.tenant_id,
        organizationId: invitation.organization_id,
        userId: actor.id,
        role: invitation.role,
        invitedBy: invitation.invited_by,
        allowSuspendedReactivation: false,
        client,
      })

      invitation.accepted_by = actor.id
      invitation.accepted_at = DateTime.now()
      await invitation.save()

      return {
        invitationId: invitation.id,
        tenantId: invitation.tenant_id,
        organizationId: invitation.organization_id,
        membershipId: membership.id,
        role: membership.role,
      }
    })

    const organization = await this.getOrganizationOrFail(result.tenantId, result.organizationId)
    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATION_INVITATIONS,
      action: IPermission.Actions.ACCEPT,
      resourceId: result.invitationId,
      metadata: { organization_id: organization.id, role: result.role },
    })

    return {
      tenant_id: result.tenantId,
      organization,
      membership_id: result.membershipId,
      role: result.role,
    }
  }

  private async ensureNotActiveMember(
    tenantId: number,
    organizationId: number,
    email: string
  ): Promise<void> {
    const user = await User.findBy('email', email)
    if (!user) {
      return
    }

    const membership = await this.memberRepository.findActiveByUser(
      tenantId,
      organizationId,
      user.id
    )
    if (membership) {
      throw new BadRequestException('This user is already an active organization member')
    }
  }

  private ensureOpen(invitation: OrganizationInvitation): void {
    if (invitation.accepted_at) {
      throw new BadRequestException('Organization invitation has already been accepted')
    }
    if (invitation.revoked_at) {
      throw new BadRequestException('Organization invitation has been revoked')
    }
  }

  private ensureOrganizationAcceptsTeamChanges(organization: Organization): void {
    if (['rejected', 'archived'].includes(organization.status)) {
      throw new BadRequestException(
        `Organization cannot manage invitations while ${organization.status}`
      )
    }
  }

  private async sendInvitation(
    invitation: OrganizationInvitation,
    organization: Organization,
    actor: User,
    token: string
  ): Promise<boolean> {
    try {
      await mail.send(
        new OrganizationInvitationNotification(
          invitation.email,
          organization.trade_name,
          actor.full_name,
          invitation.role,
          token,
          invitation.expires_at
        )
      )
      return true
    } catch (error) {
      HttpContext.get()?.logger.error(
        { error, invitationId: invitation.id, organizationId: organization.id },
        'Failed to deliver organization invitation'
      )
      return false
    }
  }

  private async getOrganizationOrFail(
    tenantId: number,
    organizationId: number
  ): Promise<Organization> {
    const organization = await this.organizationRepository.findByIdForTenant(
      tenantId,
      organizationId
    )
    if (!organization) {
      throw new NotFoundException('Organization not found')
    }
    return organization
  }

  private async getInvitationOrFail(
    tenantId: number,
    organizationId: number,
    invitationId: number
  ): Promise<OrganizationInvitation> {
    const invitation = await this.invitationRepository.findByIdForOrganization(
      tenantId,
      organizationId,
      invitationId
    )
    if (!invitation) {
      throw new NotFoundException('Organization invitation not found')
    }
    return invitation
  }
}
