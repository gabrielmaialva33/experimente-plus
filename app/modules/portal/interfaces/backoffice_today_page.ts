import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import type { PlatformAccess } from '#modules/organizations/services/organization_policy_service'
import type IReview from '#modules/reviews/interfaces/review_interface'

/**
 * The backoffice "Hoje" page: what the operation has to resolve today.
 *
 * Every number and row comes from the queue that owns it — organizations,
 * establishment revisions, partner content, content reports and pilot feedback — through the
 * same services those queues use. This page adds no rule of its own.
 *
 * Type aliases, not interfaces: Inertia types `render` props against
 * `Record<string, JSONDataTypes>`, and a named interface has no implicit index
 * signature, which would turn the page's props into `never`.
 */

export type BackofficeTodayCounts = {
  /** Establishment revisions waiting in `/backoffice/moderation`. */
  revisions: number
  /** Organizations sent for review, waiting in `/backoffice/organizations`. */
  organizations: number
  /** Pending claims of organizations without an owner, in the same queue. */
  organization_claims: number
  /** Partner content in review, per kind, as `/backoffice/content` counts it. */
  content: Record<IPartnerContent.ContentPath, number>
  /** Pending reports, the default filter of `/backoffice/reports`. */
  reports: number
  /** Open reports past their deadline, across the whole operation. */
  overdue_reports: number
  /** New pilot feedback; null for a moderator, who cannot read that queue. */
  feedback: number | null
}

export type BackofficeInboxItem =
  | {
      source: 'report'
      id: number
      target_type: IReview.ReportTargetType
      /** The partner content's approved title, when the target is one. */
      title: string | null
      establishment_name: string | null
      reason: IReview.ReportReason
      origin: IReview.ReportOrigin
      is_anonymous: boolean
      received_at: string | null
      due_at: string | null
      overdue: boolean
    }
  | {
      source: 'content'
      id: number
      kind: IPartnerContent.ContentPath
      title: string
      establishment_name: string | null
      received_at: string | null
      due_at: null
      overdue: false
    }
  | {
      source: 'organization'
      id: number
      trade_name: string
      legal_name: string
      received_at: string | null
      due_at: null
      overdue: false
    }
  | {
      source: 'revision'
      id: number
      public_name: string | null
      organization_name: string | null
      received_at: string | null
      due_at: null
      overdue: false
    }

export type BackofficeTodayPageProps = {
  platform_access: PlatformAccess
  counts: BackofficeTodayCounts
  /** The first items of each queue, deadlines first, then the longest waiting. */
  inbox: BackofficeInboxItem[]
}
