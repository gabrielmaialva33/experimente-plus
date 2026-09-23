export namespace IReview {
  export type ReviewStatus = 'published' | 'hidden' | 'archived'
  export type ReplyStatus = 'published' | 'hidden'
  export type ReportTargetType =
    'review' | 'reply' | 'establishment' | 'experience' | 'event' | 'showcase_item'
  export type ReportReason =
    | 'spam'
    | 'offensive'
    | 'inappropriate'
    | 'false_information'
    | 'conflict_of_interest'
    | 'harassment'
    | 'other'
  export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'

  /**
   * A ban as the operation sees it — ADR-0027 §6.
   *
   * It belongs to the membership, so the same person can be banned in one
   * operation and not in another.
   */
  /**
   * A review photo as anyone may see it: an address and a shape, never the
   * storage key, the checksum or the identifiers behind them.
   */
  export interface ReviewPhotoProjection {
    id: number
    url: string | null
    width: number | null
    height: number | null
    alt_text: string | null
  }

  export interface ReviewPhotoPayload {
    alt_text?: string | null
  }

  export interface BanState {
    user_id: number
    banned: boolean
    banned_at: string | null
    banned_by: number | null
    reason: string | null
  }

  export interface BanEvent {
    id: number
    action: 'banned' | 'unbanned'
    reason: string | null
    actor: { id: number; full_name: string } | null
    created_at: string
  }

  export interface BanPayload {
    reason: string
  }

  export interface UnbanPayload {
    reason?: string | null
  }

  /**
   * The reported content itself, as a moderation queue has to show it.
   *
   * A report stores `target_type` and `target_id` and nothing else, which is
   * the right shape for the table and useless to the person deciding: nobody
   * can judge whether something is offensive from an identifier. The queue
   * therefore resolves the target and carries the text alongside the report.
   *
   * It is deliberately narrow. The moderator needs to read what was written,
   * see who wrote it and where, and know whether it is still visible. The
   * author's email is not part of that and never travels here.
   */
  export interface ReportTargetProjection {
    type: ReportTargetType
    id: number
    /** False when the target was deleted after the report was filed. */
    exists: boolean
    /** Partner content only: the approved title the public sees. */
    title: string | null
    /** What the moderator reads. Null for an establishment, which has no text. */
    text: string | null
    /** Reviews only. */
    rating: number | null
    /**
     * Reviews only. A report about an image is judged by looking at it, so the
     * queue shows the photos beside the text.
     */
    photos: ReviewPhotoProjection[]
    /** The target's own visibility, so an already hidden item is obvious. */
    status: string | null
    author_name: string | null
    /**
     * Reviews only. A ban hides the reviews a person wrote, so it is offered
     * where it acts; on a partner's reply it would hide nothing, and offering
     * it there would promise an effect that does not happen.
     */
    author_id: number | null
    author_banned: boolean
    establishment_name: string | null
    /** The pair that builds the public link, never the numeric identity. */
    city_slug: string | null
    establishment_slug: string | null
    created_at: string | null
    /**
     * Whether resolving with `content_hidden` actually hides this target.
     *
     * Hiding is implemented for reviews and replies. An establishment leaves
     * the public catalogue through the revision lifecycle of ADR-0015, not
     * through a report, so the queue must not offer an action that would
     * silently do nothing.
     */
    can_hide: boolean
  }

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

  export const DEFAULT_REVIEW_POLICY: Omit<
    ReviewPolicyAttributes,
    'id' | 'tenant_id' | 'created_at' | 'updated_at'
  > = {
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

  export const CANONICAL_REPLY_STATUSES: readonly ReplyStatus[] = ['published', 'hidden'] as const

  export const CANONICAL_REPORT_TARGET_TYPES: readonly ReportTargetType[] = [
    'review',
    'reply',
    'establishment',
    'experience',
    'event',
    'showcase_item',
  ] as const

  /** The targets that are partner content (ADR-0028), which hide by archiving. */
  export const PARTNER_CONTENT_TARGETS = ['experience', 'event', 'showcase_item'] as const
  export type PartnerContentTarget = (typeof PARTNER_CONTENT_TARGETS)[number]
  export const isPartnerContentTarget = (value: ReportTargetType): value is PartnerContentTarget =>
    (PARTNER_CONTENT_TARGETS as readonly string[]).includes(value)

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

  export interface CreateReviewPayload {
    establishment_id: number
    rating: number
    comment?: string | null
    redemption_id?: number | null
  }

  export interface UpdateReviewPayload {
    rating?: number
    comment?: string | null
  }

  export interface CreateReplyPayload {
    comment: string
  }

  export interface CreateReportPayload {
    target_type: ReportTargetType
    target_id: number
    reason: ReportReason
    details?: string | null
  }

  export interface ResolveReportPayload {
    status: 'resolved' | 'dismissed'
    resolution_action?: string | null
    resolution_notes?: string | null
  }

  export interface UpdateReviewPolicyPayload {
    require_visit_proof?: boolean
    min_text_length?: number
    max_text_length?: number
    max_photos?: number
    max_videos?: number
    daily_limit_per_user?: number
    min_edit_interval_minutes?: number
    edit_window_days?: number
  }

  export interface ListReviewsQuery {
    page?: number
    per_page?: number
    rating?: number
    status?: ReviewStatus
  }

  export interface ListReportsQuery {
    page?: number
    per_page?: number
    status?: ReportStatus
    target_type?: ReportTargetType
  }
}

export default IReview
