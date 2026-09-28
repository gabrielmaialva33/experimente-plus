import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import { ORGANIZATION_ROLES } from '#modules/organizations/interfaces/organization_interface'
import type OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationMemberRepository from '#modules/organizations/repositories/organization_member_repository'
import PlatformAccessRepository from '#modules/organizations/repositories/platform_access_repository'
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
    manage_team: false,
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
      manage_team: true,
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
      manage_team: true,
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

/** Roles an organization admin may invite and manage: never an owner or another admin. */
const ADMIN_MANAGED_ROLES: readonly IOrganization.Role[] = ['editor', 'analyst']

/**
 * Roles the actor may grant by invitation or role change (ADR-0011): a
 * platform administrator and an owner grant any role, an organization admin
 * only editor and analyst, everyone else none. `authorizeInviteRole` enforces
 * exactly this list, and team pages use it to offer only grantable roles.
 */
export function grantableOrganizationRoles(
  capabilities: Pick<IOrganization.PolicyCapabilities, 'source' | 'role'>
): IOrganization.Role[] {
  if (capabilities.source === 'platform_admin') return [...ORGANIZATION_ROLES]
  if (capabilities.source !== 'membership') return []
  if (capabilities.role === 'owner') return [...ORGANIZATION_ROLES]
  if (capabilities.role === 'admin') return [...ADMIN_MANAGED_ROLES]
  return []
}

/**
 * Whether the actor may change, suspend or remove a member holding
 * `targetRole`, optionally moving it to `nextRole`. Owners and platform
 * administrators manage anyone; an organization admin only editors and
 * analysts, and only into those roles. The last-owner invariant is a separate
 * rule of the membership service.
 */
export function canManageOrganizationMember(
  capabilities: Pick<IOrganization.PolicyCapabilities, 'source' | 'role'>,
  targetRole: IOrganization.Role,
  nextRole?: IOrganization.Role
): boolean {
  if (capabilities.source === 'platform_admin') return true
  if (capabilities.source !== 'membership') return false
  if (capabilities.role === 'owner') return true

  return (
    capabilities.role === 'admin' &&
    ADMIN_MANAGED_ROLES.includes(targetRole) &&
    (nextRole === undefined || ADMIN_MANAGED_ROLES.includes(nextRole))
  )
}

/**
 * Builds the request access snapshot from the platform access and the active
 * memberships already loaded for the operation. Platform administrators stay
 * tenant-wide and therefore carry no scoped organization accesses.
 */
export function organizationActorAccessSnapshot(
  platformAccess: PlatformAccess | null,
  memberships: ReadonlyArray<Pick<OrganizationMember, 'organization_id' | 'role'>>
): IOrganization.ActorAccessSnapshot {
  return {
    platform_access: platformAccess,
    has_active_organization_membership: memberships.length > 0,
    organization_accesses:
      platformAccess === 'platform_admin'
        ? []
        : memberships.map((membership) => ({
            organization_id: membership.organization_id,
            capabilities: organizationPolicyCapabilitiesFor('membership', membership.role),
          })),
  }
}

@inject()
export default class OrganizationPolicyService {
  constructor(
    private memberRepository: OrganizationMemberRepository,
    private platformAccessRepository: PlatformAccessRepository
  ) {}

  async isPlatformStaff(actor: User): Promise<boolean> {
    return (await this.resolvePlatformAccess(actor)) !== null
  }

  async isPlatformAdmin(actor: User): Promise<boolean> {
    return (await this.resolvePlatformAccess(actor)) === 'platform_admin'
  }

  async resolvePlatformAccess(actor: User): Promise<PlatformAccess | null> {
    const slugs = new Set(
      await this.platformAccessRepository.listRoleSlugs(actor, PLATFORM_STAFF_ROLES)
    )

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

    return organizationActorAccessSnapshot(platformAccess, memberships)
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
    if (grantableOrganizationRoles(decision.capabilities).includes(invitedRole)) {
      return decision.membership
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
    if (canManageOrganizationMember(decision.capabilities, target.role, nextRole)) {
      return decision.membership
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
