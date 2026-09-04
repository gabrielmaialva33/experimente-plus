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

export type PlatformAccess = Exclude<IOrganization.AccessSource, 'membership'>

export interface OrganizationPolicyDecision {
  membership: OrganizationMember | null
  capabilities: IOrganization.PolicyCapabilities
}

/**
 * Canonical organization capabilities. ADR-0011 defines the membership base;
 * specialized contracts narrow it where required (ADR-0017 for analytics and
 * ADR-0021 for benefit redemptions). Keeping the mapping pure makes the exact
 * policy independently testable and reusable by page projections.
 */
export function organizationPolicyCapabilitiesFor(
  source: IOrganization.AccessSource,
  role: IOrganization.Role | null
): IOrganization.PolicyCapabilities {
  const readOnly = {
    source,
    role,
    read: true,
    update_organization: false,
    submit_organization: false,
    manage_establishments: false,
    manage_establishment_lifecycle: false,
    read_analytics: false,
    read_redemptions: false,
    validate_redemptions: false,
  } satisfies IOrganization.PolicyCapabilities

  if (source === 'platform_admin') {
    return {
      ...readOnly,
      update_organization: true,
      submit_organization: true,
      manage_establishments: true,
      manage_establishment_lifecycle: true,
      read_analytics: true,
      read_redemptions: true,
      validate_redemptions: true,
    }
  }

  if (source === 'platform_moderator') {
    return readOnly
  }

  if (role === 'owner' || role === 'admin') {
    return {
      ...readOnly,
      update_organization: true,
      submit_organization: true,
      manage_establishments: true,
      manage_establishment_lifecycle: true,
      read_analytics: true,
      read_redemptions: true,
      validate_redemptions: true,
    }
  }

  if (role === 'editor') {
    return {
      ...readOnly,
      manage_establishments: true,
      read_redemptions: true,
      validate_redemptions: true,
    }
  }

  if (role === 'analyst') {
    return {
      ...readOnly,
      read_analytics: true,
      read_redemptions: true,
    }
  }

  return {
    ...readOnly,
    read: false,
  }
}

@inject()
export default class OrganizationPolicyService {
  constructor(private memberRepository: OrganizationMemberRepository) {}

  async isPlatformStaff(actor: User): Promise<boolean> {
    return (await this.resolvePlatformAccess(actor)) !== null
  }

  async isPlatformAdmin(actor: User): Promise<boolean> {
    return (await this.resolvePlatformAccess(actor)) === 'platform_admin'
  }

  async resolvePlatformAccess(actor: User): Promise<PlatformAccess | null> {
    const roles = await actor
      .related('roles')
      .query()
      .whereIn('roles.slug', PLATFORM_STAFF_ROLES)
      .select('roles.slug')
    const slugs = new Set(roles.map((role) => role.slug))

    if (slugs.has(IRole.Slugs.ROOT) || slugs.has(IRole.Slugs.ADMIN)) {
      return 'platform_admin'
    }

    return slugs.has(IRole.Slugs.MODERATOR) ? 'platform_moderator' : null
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

  /**
   * Resolves the actor's organization access once for cross-organization reads.
   * The snapshot always preserves active membership identity. Platform
   * administrators remain tenant-wide and therefore expose no scoped
   * organization accesses. Callers may reuse this immutable request snapshot.
   */
  async resolveActorAccess(
    actor: User,
    tenantId: number
  ): Promise<IOrganization.ActorAccessSnapshot> {
    const platformAccess = await this.resolvePlatformAccess(actor)
    const memberships = await this.memberRepository.listActiveByUser(tenantId, actor.id)
    const hasActiveOrganizationMembership = memberships.length > 0

    if (platformAccess === 'platform_admin') {
      return {
        platform_access: platformAccess,
        has_active_organization_membership: hasActiveOrganizationMembership,
        organization_accesses: [],
      }
    }

    return {
      platform_access: platformAccess,
      has_active_organization_membership: hasActiveOrganizationMembership,
      organization_accesses: memberships.map((membership) => ({
        organization_id: membership.organization_id,
        capabilities: organizationPolicyCapabilitiesFor('membership', membership.role),
      })),
    }
  }

  async resolveAccess(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationPolicyDecision> {
    const platformAccess = await this.resolvePlatformAccess(actor)
    if (platformAccess === 'platform_admin') {
      return {
        membership: null,
        capabilities: organizationPolicyCapabilitiesFor('platform_admin', null),
      }
    }

    const membership = await this.memberRepository.findActiveByUser(
      tenantId,
      organizationId,
      actor.id,
      client
    )
    if (membership) {
      return {
        membership,
        capabilities: organizationPolicyCapabilitiesFor('membership', membership.role),
      }
    }

    if (platformAccess === 'platform_moderator') {
      return {
        membership: null,
        capabilities: organizationPolicyCapabilitiesFor('platform_moderator', null),
      }
    }

    throw new NotFoundException('Organization not found')
  }

  async authorizeRead(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (!decision.capabilities.read) {
      throw new NotFoundException('Organization not found')
    }

    return decision.membership
  }

  async authorizeEditOrganization(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (!decision.capabilities.update_organization) {
      throw new ForbiddenException('Only organization owners and admins may edit this organization')
    }

    return decision.membership
  }

  async authorizeSubmit(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (!decision.capabilities.submit_organization) {
      throw new ForbiddenException(
        'Only organization owners and admins may submit this organization'
      )
    }

    return decision.membership
  }

  async authorizeManageEstablishments(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (!decision.capabilities.manage_establishments) {
      throw new ForbiddenException('Your organization role cannot edit establishments')
    }

    return decision.membership
  }

  async authorizeManageEstablishmentLifecycle(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (!decision.capabilities.manage_establishment_lifecycle) {
      throw new ForbiddenException('Only organization owners and admins may change lifecycle state')
    }

    return decision.membership
  }

  async authorizeReadAnalytics(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (!decision.capabilities.read_analytics) {
      throw new ForbiddenException('This organization role cannot read analytics')
    }

    return decision.membership
  }

  async authorizeReadRedemptions(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (!decision.capabilities.read_redemptions) {
      throw new NotFoundException('Organization redemption not found')
    }

    return decision.membership
  }

  async authorizeValidateRedemptions(
    actor: User,
    tenantId: number,
    organizationId: number,
    client?: TransactionClientContract
  ): Promise<OrganizationMember | null> {
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (!decision.capabilities.validate_redemptions) {
      throw new ForbiddenException('This organization role cannot validate redemptions')
    }

    return decision.membership
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
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (decision.capabilities.source === 'platform_admin') {
      return null
    }

    const membership = decision.membership
    if (membership?.role === 'owner') {
      return membership
    }

    if (membership?.role === 'admin' && ['editor', 'analyst'].includes(invitedRole)) {
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
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (decision.capabilities.source === 'platform_admin') {
      return null
    }

    const membership = decision.membership
    if (membership?.role === 'owner') {
      return membership
    }

    const managesLimitedRole = ['editor', 'analyst'].includes(target.role)
    const assignsLimitedRole = nextRole === undefined || ['editor', 'analyst'].includes(nextRole)

    if (membership?.role === 'admin' && managesLimitedRole && assignsLimitedRole) {
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
    const decision = await this.resolveAccess(actor, tenantId, organizationId, client)
    if (decision.capabilities.source === 'platform_admin') {
      return null
    }

    if (decision.membership?.role !== 'owner') {
      throw new ForbiddenException('Only an organization owner may archive this draft')
    }

    return decision.membership
  }
}
