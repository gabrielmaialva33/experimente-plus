import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import NotFoundException from '#exceptions/not_found_exception'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import { ORGANIZATION_ROLES } from '#modules/organizations/interfaces/organization_interface'
import type {
  OrganizationTeamChooserProps,
  OrganizationTeamInvitationRow,
  OrganizationTeamMemberRow,
  OrganizationTeamPageProps,
} from '#modules/organizations/interfaces/organization_team_pages'
import type Organization from '#modules/organizations/models/organization'
import type OrganizationInvitation from '#modules/organizations/models/organization_invitation'
import type OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationRepository from '#modules/organizations/repositories/organization_repository'
import OrganizationInvitationService from '#modules/organizations/services/organization_invitation_service'
import OrganizationMembershipService from '#modules/organizations/services/organization_membership_service'
import OrganizationPolicyService, {
  canManageOrganizationMember,
  grantableOrganizationRoles,
} from '#modules/organizations/services/organization_policy_service'
import OrganizationResourceAuthorizationService, {
  type OrganizationActorAuthorizationContext,
} from '#modules/organizations/services/organization_resource_authorization_service'
import OrganizationService from '#modules/organizations/services/organization_service'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import PermissionService from '#modules/permissions/services/permission_service'
import type User from '#modules/users/models/user'

const CLOSED_ORGANIZATION_STATUSES = new Set<IOrganization.Status>(['rejected', 'archived'])

const permissionName = (resource: IPermission.Resources, action: IPermission.Actions) =>
  `${resource}.${action}`

export interface OrganizationTeamProjectionInput {
  organization: Pick<Organization, 'id' | 'trade_name' | 'status'>
  capabilities: Pick<IOrganization.PolicyCapabilities, 'source' | 'role'>
  actorId: number
  permissionNames: ReadonlySet<string>
  members: OrganizationMember[]
  invitations: OrganizationInvitation[]
  now?: DateTime
}

/**
 * Projects the team page from the organization policy (who may grant or
 * manage which role), the global permissions each route carries and the
 * membership invariants (the last active owner stays). Pure, so the matrix is
 * unit-tested without HTTP; the services repeat every check on write.
 */
export function projectOrganizationTeamPage(
  input: OrganizationTeamProjectionInput
): OrganizationTeamPageProps {
  const now = input.now ?? DateTime.now()
  const has = (resource: IPermission.Resources, action: IPermission.Actions) =>
    input.permissionNames.has(permissionName(resource, action))
  const canUpdateMembers = has(
    IPermission.Resources.ORGANIZATION_MEMBERS,
    IPermission.Actions.UPDATE
  )
  const canRemoveMembers = has(
    IPermission.Resources.ORGANIZATION_MEMBERS,
    IPermission.Actions.DELETE
  )
  const canInvite = has(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.CREATE)
  const canResend = has(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.RESEND)
  const canRevoke = has(IPermission.Resources.ORGANIZATION_INVITATIONS, IPermission.Actions.REVOKE)
  const acceptsInvitations = !CLOSED_ORGANIZATION_STATUSES.has(input.organization.status)
  const grantable = grantableOrganizationRoles(input.capabilities)

  const visibleMembers = input.members.filter(
    (member): member is OrganizationMember & { status: IOrganization.MutableMemberStatus } =>
      member.status !== 'removed'
  )
  const activeOwners = visibleMembers.filter(
    (member) => member.role === 'owner' && member.status === 'active'
  ).length

  const members = visibleMembers.map((member): OrganizationTeamMemberRow => {
    const isSelf = member.user_id === input.actorId
    const isLastOwner = member.role === 'owner' && member.status === 'active' && activeOwners <= 1
    const manageable = !isSelf && canManageOrganizationMember(input.capabilities, member.role)

    return {
      id: member.id,
      user: {
        id: member.user_id,
        full_name: member.user?.full_name ?? '',
        email: member.user?.email ?? '',
      },
      role: member.role,
      status: member.status,
      joined_at: member.joined_at?.toISO() ?? null,
      suspended_at: member.suspended_at?.toISO() ?? null,
      is_self: isSelf,
      is_last_owner: isLastOwner,
      actions: {
        roles:
          canUpdateMembers && manageable && !isLastOwner
            ? ORGANIZATION_ROLES.filter(
                (role) =>
                  role !== member.role &&
                  canManageOrganizationMember(input.capabilities, member.role, role)
              )
            : [],
        suspend: canUpdateMembers && manageable && member.status === 'active' && !isLastOwner,
        reactivate: canUpdateMembers && manageable && member.status === 'suspended',
        remove: canRemoveMembers && manageable && !isLastOwner,
      },
    }
  })

  const invitations = input.invitations
    .filter((invitation) => !invitation.accepted_at && !invitation.revoked_at)
    .map((invitation): OrganizationTeamInvitationRow => {
      const handlesRole = grantable.includes(invitation.role)

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        state: invitation.expires_at.toMillis() <= now.toMillis() ? 'expired' : 'pending',
        expires_at: invitation.expires_at.toISO() ?? '',
        created_at: invitation.created_at.toISO() ?? '',
        invited_by: invitation.inviter?.full_name ?? null,
        actions: {
          resend: canResend && handlesRole && acceptsInvitations,
          cancel: canRevoke && handlesRole,
        },
      }
    })

  return {
    organization: {
      id: input.organization.id,
      trade_name: input.organization.trade_name,
      status: input.organization.status,
      accepts_invitations: acceptsInvitations,
    },
    viewer: {
      source: input.capabilities.source,
      role: input.capabilities.role,
    },
    members,
    invitations,
    invite_roles: canInvite && acceptsInvitations ? grantable : [],
  }
}

@inject()
export default class OrganizationTeamPageService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private organizationService: OrganizationService,
    private membershipService: OrganizationMembershipService,
    private invitationService: OrganizationInvitationService,
    private policy: OrganizationPolicyService,
    private resourceAuthorization: OrganizationResourceAuthorizationService,
    private permissionService: PermissionService
  ) {}

  /**
   * The member and invitation lists come from the same services as the API,
   * so reading the page is authorized exactly like `GET .../members`.
   */
  async page(
    tenantId: number,
    organizationId: number,
    actor: User
  ): Promise<OrganizationTeamPageProps> {
    const members = await this.membershipService.list(tenantId, organizationId, actor)
    const invitations = await this.invitationService.list(tenantId, organizationId, actor)
    const organization = await this.organizationRepository.findByIdForTenant(
      tenantId,
      organizationId
    )
    if (!organization) {
      throw new NotFoundException('Organization not found')
    }

    const decision = await this.policy.resolveAccess(actor, tenantId, organizationId)
    const permissions = await this.permissionService.getEffectivePermissionNames(actor.id)

    return projectOrganizationTeamPage({
      organization,
      capabilities: decision.capabilities,
      actorId: actor.id,
      permissionNames: new Set(permissions),
      members,
      invitations,
    })
  }

  /** Organizations whose team the actor may see, for `/portal/team`. */
  async chooser(
    tenantId: number,
    context: OrganizationActorAuthorizationContext
  ): Promise<OrganizationTeamChooserProps> {
    const organizations = await this.organizationService.listFromAccessSnapshot(
      tenantId,
      context.access_snapshot
    )
    const roleByOrganization = new Map(
      context.access_snapshot.organization_accesses.map((access) => [
        access.organization_id,
        access.capabilities.role,
      ])
    )

    return {
      organizations: organizations
        .map((organization) => ({
          organization,
          actions: this.resourceAuthorization.forOrganizationFromContext(organization.id, context),
        }))
        .filter(({ actions }) => actions.team.read)
        .map(({ organization, actions }) => ({
          id: organization.id,
          trade_name: organization.trade_name,
          status: organization.status,
          role: roleByOrganization.get(organization.id) ?? null,
          can_manage: actions.team.manage,
        })),
    }
  }
}
