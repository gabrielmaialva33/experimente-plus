export const ORGANIZATION_STATUSES = [
  'draft',
  'pending_review',
  'changes_requested',
  'active',
  'rejected',
  'suspended',
  'archived',
] as const

export const ORGANIZATION_ROLES = ['owner', 'admin', 'editor', 'analyst'] as const
export const ORGANIZATION_MEMBER_STATUSES = ['active', 'suspended', 'removed'] as const
export const MUTABLE_ORGANIZATION_MEMBER_STATUSES = ['active', 'suspended'] as const
export const ORGANIZATION_CLAIM_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const

namespace IOrganization {
  export type Status = (typeof ORGANIZATION_STATUSES)[number]
  export type Role = (typeof ORGANIZATION_ROLES)[number]
  export type MemberStatus = (typeof ORGANIZATION_MEMBER_STATUSES)[number]
  export type MutableMemberStatus = (typeof MUTABLE_ORGANIZATION_MEMBER_STATUSES)[number]
  export type ClaimStatus = (typeof ORGANIZATION_CLAIM_STATUSES)[number]

  /**
   * Domain-level access resolved from either an active organization membership
   * or an explicit platform staff role. Global permissions are applied later,
   * when page actions are projected for the current actor.
   */
  export type AccessSource = 'membership' | 'platform_admin' | 'platform_moderator'

  export interface PolicyCapabilities {
    source: AccessSource
    role: Role | null
    read: boolean
    update_organization: boolean
    submit_organization: boolean
    manage_establishments: boolean
    manage_establishment_lifecycle: boolean
    read_analytics: boolean
    read_redemptions: boolean
    validate_redemptions: boolean
  }

  export interface ActorAccessSnapshot {
    readonly platform_access: Exclude<AccessSource, 'membership'> | null
    readonly has_active_organization_membership: boolean
    readonly organization_accesses: ReadonlyArray<{
      readonly organization_id: number
      readonly capabilities: PolicyCapabilities
    }>
  }

  /**
   * Server-projected actions for organization-scoped Portal resources. Every
   * flag combines the global permission required by the route with the domain
   * policy for the organization. The frontend may hide controls from these
   * values, but the services remain the authorization authority.
   */
  export interface AllowedActions {
    organizations: {
      read: boolean
      update: boolean
      submit: boolean
    }
    establishments: {
      read: boolean
      list: boolean
      create: boolean
      create_revision: boolean
      update: boolean
      submit: boolean
      archive: boolean
    }
    benefit_offers: {
      read: boolean
      list: boolean
      create: boolean
      update: boolean
      activate: boolean
      pause: boolean
      archive: boolean
    }
    redemptions: {
      read: boolean
      validate: boolean
    }
    analytics: {
      read: boolean
    }
    pilot_feedback: {
      create: boolean
    }
  }

  export interface CreatePayload {
    legal_name: string
    trade_name: string
    slug?: string
    tax_id: string
    email: string
    phone: string
    website?: string | null
  }

  export interface UpdatePayload {
    legal_name?: string
    trade_name?: string
    slug?: string
    tax_id?: string
    email?: string
    phone?: string
    website?: string | null
  }

  export interface MemberUpdatePayload {
    role?: Role
    status?: MutableMemberStatus
  }

  export interface InvitationPayload {
    email: string
    role: Role
  }

  export interface ClaimEvidence {
    description?: string
    document_file_ids?: number[]
  }

  export interface ClaimPayload {
    message?: string | null
    evidence?: ClaimEvidence | null
  }
}

export default IOrganization
