import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationMemberRepository from '#modules/organizations/repositories/organization_member_repository'
import OrganizationRepository from '#modules/organizations/repositories/organization_repository'
import OrganizationAuditService from '#modules/organizations/services/organization_audit_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import type User from '#modules/users/models/user'

export type ActivateOrganizationMemberOptions = {
  tenantId: number
  organizationId: number
  userId: number
  role: IOrganization.Role
  invitedBy: number | null
  allowSuspendedReactivation: boolean
  client: TransactionClientContract
}

@inject()
export default class OrganizationMembershipService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private memberRepository: OrganizationMemberRepository,
    private policy: OrganizationPolicyService,
    private audit: OrganizationAuditService
  ) {}

  async list(tenantId: number, organizationId: number, actor: User): Promise<OrganizationMember[]> {
    await this.ensureOrganization(tenantId, organizationId)
    await this.policy.authorizeListMembers(actor, tenantId, organizationId)
    return this.memberRepository.listByOrganization(tenantId, organizationId)
  }

  async update(
    tenantId: number,
    organizationId: number,
    memberId: number,
    actor: User,
    payload: IOrganization.MemberUpdatePayload
  ): Promise<OrganizationMember> {
    if (payload.role === undefined && payload.status === undefined) {
      throw new BadRequestException('At least one membership field must be provided')
    }

    await db.transaction(async (client) => {
      await this.ensureOrganization(tenantId, organizationId, client, true)
      const members = await this.memberRepository.lockAllForOrganization(
        tenantId,
        organizationId,
        client
      )
      const target = members.find((member) => member.id === memberId)

      if (!target) {
        throw new NotFoundException('Organization member not found')
      }
      if (target.status === 'removed') {
        throw new BadRequestException(
          'Removed memberships may only be reactivated by invitation or claim'
        )
      }

      await this.policy.authorizeManageMember(
        actor,
        tenantId,
        organizationId,
        target,
        payload.role,
        client
      )

      const nextRole = payload.role ?? target.role
      const nextStatus = payload.status ?? target.status
      this.ensureOrganizationKeepsOwner(members, target, nextRole, nextStatus)

      target.role = nextRole
      target.status = nextStatus
      target.removed_at = null
      target.suspended_at = nextStatus === 'suspended' ? DateTime.now() : null
      await target.save()
    })

    const member = await this.getMemberOrFail(tenantId, organizationId, memberId)
    await member.load('user')
    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATION_MEMBERS,
      action: IPermission.Actions.UPDATE,
      resourceId: member.id,
      metadata: {
        organization_id: organizationId,
        role: member.role,
        status: member.status,
      },
    })

    return member
  }

  async remove(
    tenantId: number,
    organizationId: number,
    memberId: number,
    actor: User
  ): Promise<void> {
    await db.transaction(async (client) => {
      await this.ensureOrganization(tenantId, organizationId, client, true)
      const members = await this.memberRepository.lockAllForOrganization(
        tenantId,
        organizationId,
        client
      )
      const target = members.find((member) => member.id === memberId)

      if (!target) {
        throw new NotFoundException('Organization member not found')
      }
      if (target.status === 'removed') {
        throw new BadRequestException('Organization member is already removed')
      }

      await this.policy.authorizeManageMember(
        actor,
        tenantId,
        organizationId,
        target,
        undefined,
        client
      )
      this.ensureOrganizationKeepsOwner(members, target, target.role, 'removed')

      target.status = 'removed'
      target.removed_at = DateTime.now()
      target.suspended_at = null
      await target.save()
    })

    await this.audit.log({
      actorId: actor.id,
      resource: IPermission.Resources.ORGANIZATION_MEMBERS,
      action: IPermission.Actions.DELETE,
      resourceId: memberId,
      metadata: { organization_id: organizationId },
    })
  }

  async activateOrCreateMember(
    options: ActivateOrganizationMemberOptions
  ): Promise<OrganizationMember> {
    await this.memberRepository.ensureTenantMembership(
      options.tenantId,
      options.userId,
      options.client
    )

    const existing = await this.memberRepository.findByUser(
      options.tenantId,
      options.organizationId,
      options.userId,
      options.client,
      true
    )

    if (!existing) {
      return this.memberRepository.create(
        {
          tenant_id: options.tenantId,
          organization_id: options.organizationId,
          user_id: options.userId,
          role: options.role,
          status: 'active',
          invited_by: options.invitedBy,
        },
        options.client
      )
    }

    if (existing.status === 'active') {
      throw new BadRequestException('User is already an active organization member')
    }
    if (existing.status === 'suspended' && !options.allowSuspendedReactivation) {
      throw new BadRequestException('Suspended membership requires an administrative decision')
    }

    existing.role = options.role
    existing.status = 'active'
    existing.invited_by = options.invitedBy
    existing.joined_at = DateTime.now()
    existing.suspended_at = null
    existing.removed_at = null
    await existing.save()
    return existing
  }

  private ensureOrganizationKeepsOwner(
    members: OrganizationMember[],
    target: OrganizationMember,
    nextRole: IOrganization.Role,
    nextStatus: IOrganization.MemberStatus
  ): void {
    const removesActiveOwner =
      target.role === 'owner' &&
      target.status === 'active' &&
      (nextRole !== 'owner' || nextStatus !== 'active')

    if (!removesActiveOwner) {
      return
    }

    const activeOwners = members.filter(
      (member) => member.role === 'owner' && member.status === 'active'
    )
    if (activeOwners.length <= 1) {
      throw new BadRequestException('The last active organization owner cannot be changed')
    }
  }

  private async ensureOrganization(
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract,
    forUpdate = false
  ): Promise<void> {
    const organization = await this.organizationRepository.findByIdForTenant(
      tenantId,
      organizationId,
      client,
      forUpdate
    )
    if (!organization) {
      throw new NotFoundException('Organization not found')
    }
  }

  private async getMemberOrFail(
    tenantId: number,
    organizationId: number,
    memberId: number
  ): Promise<OrganizationMember> {
    const member = await this.memberRepository.findByIdForOrganization(
      tenantId,
      organizationId,
      memberId
    )
    if (!member) {
      throw new NotFoundException('Organization member not found')
    }
    return member
  }
}
