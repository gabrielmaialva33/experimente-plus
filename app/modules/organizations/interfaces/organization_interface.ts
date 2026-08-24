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
