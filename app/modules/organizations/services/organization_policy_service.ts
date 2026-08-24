import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationMemberRepository from '#modules/organizations/repositories/organization_member_repository'
import IRole from '#modules/roles/interfaces/role_interface'
import type User from '#modules/users/models/user'

const PLATFORM_STAFF_ROLES = [IRole.Slugs.ROOT, IRole.Slugs.ADMIN, IRole.Slugs.MODERATOR]
const PLATFORM_ADMIN_ROLES = [IRole.Slugs.ROOT, IRole.Slugs.ADMIN]

@inject()
export default class OrganizationPolicyService {
  constructor(private memberRepository: OrganizationMemberRepository) {}

  async isPlatformStaff(actor: User): Promise<boolean> {
    return this.hasGlobalRole(actor, PLATFORM_STAFF_ROLES)
  }

  async isPlatformAdmin(actor: User): Promise<boolean> {
    return this.hasGlobalRole(actor, PLATFORM_ADMIN_ROLES)
  }

  async requirePlatformModerator(actor: User): Promise<void> {
    if (!(await this.isPlatformStaff(actor))) {
      throw new ForbiddenException('Platform moderation permission is required')
    }
  }

  async requirePlatformAdmin(actor: User): Promise<void> {
    if (!(await this.isPlatformAdmin(actor))) {
      throw new ForbiddenException('Platform administrator permission is required')
    }
  }

  async authorizeRead(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    if (await this.isPlatformStaff(actor)) {
      return null
    }

    return this.requireActiveMembership(actor.id, tenantId, organizationId, client)
  }

  async authorizeEditOrganization(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    if (await this.isPlatformAdmin(actor)) {
      return null
    }

    const membership = await this.requireActiveMembership(
      actor.id,
      tenantId,
      organizationId,
      client
    )

    if (!['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenException('Only organization owners and admins may edit this organization')
    }

    return membership
  }

  async authorizeSubmit(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    return this.authorizeEditOrganization(actor, tenantId, organizationId, client)
  }

  async authorizeManageEstablishments(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    if (await this.isPlatformAdmin(actor)) {
      return null
    }

    const membership = await this.requireActiveMembership(
      actor.id,
      tenantId,
      organizationId,
      client
    )

    if (!['owner', 'admin', 'editor'].includes(membership.role)) {
      throw new ForbiddenException('Your organization role cannot edit establishments')
    }

    return membership
  }

  async authorizeManageEstablishmentLifecycle(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    if (await this.isPlatformAdmin(actor)) {
      return null
    }

    const membership = await this.requireActiveMembership(
      actor.id,
      tenantId,
      organizationId,
      client
    )

    if (!['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenException('Only organization owners and admins may change lifecycle state')
    }

    return membership
  }

  async authorizeListMembers(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    return this.authorizeRead(actor, tenantId, organizationId, client)
  }

  async authorizeInviteRole(
    actor: User,
    tenantId: number,
    organizationId: number,
    invitedRole: IOrganization.Role,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    if (await this.isPlatformAdmin(actor)) {
      return null
    }

    const membership = await this.requireActiveMembership(
      actor.id,
      tenantId,
      organizationId,
      client
    )

    if (membership.role === 'owner') {
      return membership
    }

    if (membership.role === 'admin' && ['editor', 'analyst'].includes(invitedRole)) {
      return membership
    }

    throw new ForbiddenException('Your organization role cannot create this invitation')
  }

  async authorizeManageMember(
    actor: User,
    tenantId: number,
    organizationId: number,
    target: OrganizationMember,
    nextRole?: IOrganization.Role,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    if (await this.isPlatformAdmin(actor)) {
      return null
    }

    const membership = await this.requireActiveMembership(
      actor.id,
      tenantId,
      organizationId,
      client
    )

    if (membership.role === 'owner') {
      return membership
    }

    const managesLimitedRole = ['editor', 'analyst'].includes(target.role)
    const assignsLimitedRole = nextRole === undefined || ['editor', 'analyst'].includes(nextRole)

    if (membership.role === 'admin' && managesLimitedRole && assignsLimitedRole) {
      return membership
    }

    throw new ForbiddenException('Your organization role cannot manage this member')
  }

  async authorizeArchiveDraft(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    if (await this.isPlatformAdmin(actor)) {
      return null
    }

    const membership = await this.requireActiveMembership(
      actor.id,
      tenantId,
      organizationId,
      client
    )

    if (membership.role !== 'owner') {
      throw new ForbiddenException('Only an organization owner may archive this draft')
    }

    return membership
  }

  private async requireActiveMembership(
    userId: number,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember> {
    const membership = await this.memberRepository.findActiveByUser(
      tenantId,
      organizationId,
      userId,
      client
    )

    if (!membership) {
      throw new NotFoundException('Organization not found')
    }

    return membership
  }

  private async hasGlobalRole(actor: User, roles: IRole.Slugs[]): Promise<boolean> {
    return Boolean(await actor.related('roles').query().whereIn('roles.slug', roles).first())
  }
}
