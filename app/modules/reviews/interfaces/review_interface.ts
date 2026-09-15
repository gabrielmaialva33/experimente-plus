export namespace IReview {
  export type ReviewStatus = 'published' | 'hidden' | 'archived'
  export type ReplyStatus = 'published' | 'hidden'
  export type ReportTargetType = 'review' | 'reply' | 'establishment'
  export type ReportReason =
    | 'spam'
    | 'offensive'
    | 'inappropriate'
    | 'false_information'
    | 'conflict_of_interest'
    | 'harassment'
    | 'other'
  export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'

  export interface ReviewPolicyAttributes {
    id?: number
    tenant_id: number
    require_visit_proof: boolean
    min_text_length: number
    max_text_length: number
    max_photos: number
    max_videos: number
    daily_limit_per_user: number
    min_edit_interval_minutes: number
    edit_window_days: number
    created_at?: Date
    updated_at?: Date
  }

  export const DEFAULT_REVIEW_POLICY: Omit<ReviewPolicyAttributes, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> = {
    require_visit_proof: false,
    min_text_length: 0,
    max_text_length: 1000,
    max_photos: 4,
    max_videos: 0,
    daily_limit_per_user: 5,
    min_edit_interval_minutes: 60,
    edit_window_days: 30,
  }

  export const CANONICAL_REVIEW_STATUSES: readonly ReviewStatus[] = [
    'published',
    'hidden',
    'archived',
  ] as const

  export const CANONICAL_REPLY_STATUSES: readonly ReplyStatus[] = [
    'published',
    'hidden',
  ] as const

  export const CANONICAL_REPORT_TARGET_TYPES: readonly ReportTargetType[] = [
    'review',
    'reply',
    'establishment',
  ] as const

  export const CANONICAL_REPORT_REASONS: readonly ReportReason[] = [
    'spam',
    'offensive',
    'inappropriate',
    'false_information',
    'conflict_of_interest',
    'harassment',
    'other',
  ] as const

  export const CANONICAL_REPORT_STATUSES: readonly ReportStatus[] = [
    'pending',
    'under_review',
    'resolved',
    'dismissed',
  ] as const

  export function isValidRating(rating: number): boolean {
    return Number.isInteger(rating) && rating >= 1 && rating <= 5
  }

  export function isReviewStatus(value: string): value is ReviewStatus {
    return (CANONICAL_REVIEW_STATUSES as readonly string[]).includes(value)
  }

  export function isReplyStatus(value: string): value is ReplyStatus {
    return (CANONICAL_REPLY_STATUSES as readonly string[]).includes(value)
  }

  export function isReportTargetType(value: string): value is ReportTargetType {
    return (CANONICAL_REPORT_TARGET_TYPES as readonly string[]).includes(value)
  }

  export function isReportReason(value: string): value is ReportReason {
    return (CANONICAL_REPORT_REASONS as readonly string[]).includes(value)
  }

  export function isReportStatus(value: string): value is ReportStatus {
    return (CANONICAL_REPORT_STATUSES as readonly string[]).includes(value)
  }
}

export default IReview
