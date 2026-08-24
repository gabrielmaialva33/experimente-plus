import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'

export const ESTABLISHMENT_REVISION_EVENT_TYPES = [
  'created',
  'submitted',
  'changes_requested',
  'resubmitted',
  'approved',
  'rejected',
  'published',
  'draft_cloned',
] as const

export const ESTABLISHMENT_REVIEW_ISSUE_SEVERITIES = ['blocking', 'warning'] as const

export namespace IEstablishmentReview {
  export type EventType = (typeof ESTABLISHMENT_REVISION_EVENT_TYPES)[number]
  export type IssueSeverity = (typeof ESTABLISHMENT_REVIEW_ISSUE_SEVERITIES)[number]

  export interface IssuePayload {
    code: string
    field: string
    message: string
    severity: IssueSeverity
  }

  export interface DecisionPayload {
    reason?: string | null
  }

  export interface RequestChangesPayload {
    reason: string
    issues: IssuePayload[]
  }

  export interface QueueQuery {
    tenant_id?: number
    organization_id?: number
    city_id?: number
    page: number
    per_page: number
  }

  export interface CreateRevisionPayload {
    source?: 'published' | 'latest_terminal'
  }

  export interface GateIssue {
    code: string
    field: string
    message: string
    severity: IssueSeverity
    metadata?: Record<string, unknown>
  }

  export interface GateResult {
    eligible: boolean
    score: number
    blocking_issues: GateIssue[]
    warnings: GateIssue[]
    checked_at: string
    rules_version: number
  }

  export interface EventMetadata {
    [key: string]: unknown
  }

  export interface QueueItem {
    id: number
    tenant_id: number
    establishment_id: number
    version: number
    status: IEstablishment.RevisionStatus
    submitted_at: string
    public_name: string | null
    city_id: number | null
    organization_id: number
    organization_name: string
  }
}

export default IEstablishmentReview
