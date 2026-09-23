import vine from '@vinejs/vine'

import IReview from '#modules/reviews/interfaces/review_interface'

export const createReviewValidator = vine.compile(
  vine.object({
    establishment_id: vine.number().min(1),
    rating: vine.number().withoutDecimals().min(1).max(5),
    comment: vine.string().trim().nullable().optional(),
    redemption_id: vine.number().min(1).nullable().optional(),
  })
)

export const updateReviewValidator = vine.compile(
  vine.object({
    rating: vine.number().withoutDecimals().min(1).max(5).optional(),
    comment: vine.string().trim().nullable().optional(),
  })
)

export const createReplyValidator = vine.compile(
  vine.object({
    comment: vine.string().trim().minLength(1).maxLength(4000),
  })
)

export const createReportValidator = vine.compile(
  vine.object({
    target_type: vine.enum(IReview.CANONICAL_REPORT_TARGET_TYPES),
    target_id: vine.number().min(1),
    reason: vine.enum(IReview.CANONICAL_REPORT_REASONS),
    details: vine.string().trim().minLength(1).maxLength(4000).nullable().optional(),
  })
)

export const resolveReportValidator = vine.compile(
  vine.object({
    status: vine.enum(['resolved', 'dismissed'] as const),
    resolution_action: vine.string().trim().minLength(1).maxLength(40).nullable().optional(),
    resolution_notes: vine.string().trim().minLength(1).maxLength(4000).nullable().optional(),
  })
)

export const updateReviewPolicyValidator = vine.compile(
  vine.object({
    require_visit_proof: vine.boolean().optional(),
    min_text_length: vine.number().withoutDecimals().min(0).optional(),
    max_text_length: vine.number().withoutDecimals().min(0).optional(),
    max_photos: vine.number().withoutDecimals().min(0).optional(),
    max_videos: vine.number().withoutDecimals().min(0).optional(),
    daily_limit_per_user: vine.number().withoutDecimals().min(0).optional(),
    min_edit_interval_minutes: vine.number().withoutDecimals().min(0).optional(),
    edit_window_days: vine.number().withoutDecimals().min(0).optional(),
  })
)

export const listReviewsQueryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
    rating: vine.number().withoutDecimals().min(1).max(5).optional(),
    status: vine.enum(IReview.CANONICAL_REVIEW_STATUSES).optional(),
  })
)

export const listReportsQueryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
    status: vine.enum(IReview.CANONICAL_REPORT_STATUSES).optional(),
    target_type: vine.enum(IReview.CANONICAL_REPORT_TARGET_TYPES).optional(),
  })
)

/**
 * The anonymous report — ADR-0027 scenarios 13 and 14. The same fields as an
 * identified report, plus an optional token the app generates and keeps so a
 * repeat is recognised across networks. The token is opaque and grants nothing.
 */
export const createAnonymousReportValidator = vine.compile(
  vine.object({
    target_type: vine.enum(IReview.CANONICAL_REPORT_TARGET_TYPES),
    target_id: vine.number().min(1),
    reason: vine.enum(IReview.CANONICAL_REPORT_REASONS),
    details: vine.string().trim().minLength(1).maxLength(4000).nullable().optional(),
    anonymous_token: vine
      .string()
      .trim()
      .minLength(16)
      .maxLength(128)
      .regex(/^[A-Za-z0-9-]+$/)
      .nullable()
      .optional(),
  })
)

export const reviewIdValidator = vine.compile(
  vine.object({
    id: vine.number().min(1),
  })
)

export const establishmentReviewParamsValidator = vine.compile(
  vine.object({
    establishmentId: vine.number().min(1),
  })
)

export const reviewReplyParamsValidator = vine.compile(
  vine.object({
    reviewId: vine.number().min(1),
  })
)

export const userIdParamsValidator = vine.compile(
  vine.object({
    userId: vine.number().min(1),
  })
)

/**
 * A ban requires a reason. It is what makes the audit trail of ADR-0027 §6 mean
 * something, and it is what a later moderator reads before deciding to lift it.
 */
export const banPayloadValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(3).maxLength(500),
  })
)

export const unbanPayloadValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().maxLength(500).nullable().optional(),
  })
)

export const reviewPhotoParamsValidator = vine.compile(
  vine.object({
    id: vine.number().min(1),
    photoId: vine.number().min(1),
  })
)

/**
 * The photo itself is validated by the request's file options and then by the
 * image probe, as all media is. This only covers the description, which a
 * screen reader reads in place of the image.
 */
export const reviewPhotoValidator = vine.compile(
  vine.object({
    alt_text: vine.string().trim().maxLength(180).nullable().optional(),
  })
)
