import type IOrganization from '#modules/organizations/interfaces/organization_interface'

/**
 * Inertia contracts of the partner "Equipe" pages and of the invitation
 * acceptance page.
 *
 * Type aliases, not interfaces: Inertia types `render` props against
 * `Record<string, JSONDataTypes>`, and a named interface has no implicit index
 * signature. Every action flag is a server projection of the same policy the
 * services enforce; the page only hides what the server would refuse.
 */

export type OrganizationTeamMemberRow = {
  id: number
  user: { id: number; full_name: string; email: string }
  role: IOrganization.Role
  status: IOrganization.MutableMemberStatus
  joined_at: string | null
  suspended_at: string | null
  /** The viewer's own membership: the page offers no action on it. */
  is_self: boolean
  /** The only active owner, which the membership service keeps in place. */
  is_last_owner: boolean
  actions: {
    /** Roles this member may be moved to, excluding the current one. */
    roles: IOrganization.Role[]
    suspend: boolean
    reactivate: boolean
    remove: boolean
  }
}

export type OrganizationTeamInvitationRow = {
  id: number
  email: string
  role: IOrganization.Role
  state: 'pending' | 'expired'
  expires_at: string
  created_at: string
  invited_by: string | null
  actions: {
    resend: boolean
    cancel: boolean
  }
}

export type OrganizationTeamPageProps = {
  organization: {
    id: number
    trade_name: string
    status: IOrganization.Status
    /** Rejected and archived organizations accept no invitations. */
    accepts_invitations: boolean
  }
  viewer: {
    source: IOrganization.AccessSource
    role: IOrganization.Role | null
  }
  members: OrganizationTeamMemberRow[]
  invitations: OrganizationTeamInvitationRow[]
  /** Roles the viewer may invite; empty when the viewer cannot invite. */
  invite_roles: IOrganization.Role[]
}

/** `/portal/team` when the viewer reaches more than one organization team. */
export type OrganizationTeamChooserProps = {
  organizations: {
    id: number
    trade_name: string
    status: IOrganization.Status
    role: IOrganization.Role | null
    can_manage: boolean
  }[]
}

export type OrganizationInvitationPreviewState =
  'missing' | 'invalid' | 'accepted' | 'revoked' | 'unavailable' | 'expired' | 'open'

/**
 * What the acceptance page may show. The token never travels in these props,
 * and the invited address only as a hint unless the viewer owns it.
 */
export type OrganizationInvitationAcceptPageProps = {
  state: OrganizationInvitationPreviewState
  invitation: {
    organization_name: string
    role: IOrganization.Role
    inviter_name: string | null
    expires_at: string
    email_hint: string
  } | null
  viewer: {
    signed_in: boolean
    email: string | null
    /** The signed-in account is the invited address. */
    matches: boolean
    /** The signed-in account's current membership in the inviting organization. */
    membership: IOrganization.MutableMemberStatus | null
    /** The signed-in account accepted this invitation already. */
    accepted: boolean
  }
  /** Where an active member of the organization continues in the Portal. */
  portal_path: string | null
}
