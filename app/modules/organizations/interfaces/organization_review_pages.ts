import type IOrganization from '#modules/organizations/interfaces/organization_interface'

/**
 * Inertia contracts of the back-office "Organizações" queue: the businesses
 * waiting for the operation's decision and the claims of organizations
 * without an owner.
 *
 * Type aliases, not interfaces: Inertia types `render` props against
 * `Record<string, JSONDataTypes>`, and a named interface has no implicit index
 * signature. The action flags only hide what the workflow and claim services
 * would refuse; both services check the platform policy again on every write.
 */

export type OrganizationReviewPerson = {
  id: number
  full_name: string
  email: string
}

export type OrganizationReviewQueueRow = {
  id: number
  trade_name: string
  legal_name: string
  tax_id: string
  status: IOrganization.Status
  submitted_at: string | null
  /** Who sent it for review; the creator when no submission was recorded. */
  submitted_by: OrganizationReviewPerson | null
  establishments: number
}

export type OrganizationClaimQueueRow = {
  id: number
  created_at: string | null
  message: string | null
  evidence_description: string | null
  document_count: number
  claimant: OrganizationReviewPerson | null
  organization: {
    id: number
    trade_name: string
    legal_name: string
    tax_id: string
    status: IOrganization.Status
  } | null
}

export type OrganizationReviewDecisions = {
  approve: boolean
  request_changes: boolean
  reject: boolean
}

export type OrganizationReviewQueuePageProps = {
  /** The state the list shows; `pending_review` is the queue itself. */
  status: IOrganization.Status
  /** Organizations per state in the operation, for the filter. */
  counts: Record<IOrganization.Status, number>
  organizations: OrganizationReviewQueueRow[]
  claims: OrganizationClaimQueueRow[]
  claim_decisions: { approve: boolean; reject: boolean }
}

export type OrganizationReviewHistoryEntry = {
  id: number
  action: string
  status: IOrganization.Status | null
  reason: string | null
  actor: string | null
  at: string | null
}

export type OrganizationReviewPageProps = {
  organization: {
    id: number
    legal_name: string
    trade_name: string
    slug: string
    tax_id: string
    email: string
    phone: string
    website: string | null
    status: IOrganization.Status
    created_at: string | null
    submitted_at: string | null
    reviewed_at: string | null
    review_notes: string | null
    reviewed_by: string | null
  }
  submitted_by: OrganizationReviewPerson | null
  created_by: OrganizationReviewPerson | null
  members: Array<{
    id: number
    full_name: string
    email: string
    role: IOrganization.Role
    status: IOrganization.MemberStatus
  }>
  establishments: Array<{
    id: number
    public_name: string | null
    city_name: string | null
    revision_status: string | null
    published: boolean
  }>
  history: OrganizationReviewHistoryEntry[]
  /** Decisions offered on this page: only while the organization is in review. */
  decisions: OrganizationReviewDecisions
}
