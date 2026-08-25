import vine from '@vinejs/vine'

import {
  PILOT_FEEDBACK_CONTEXTS,
  PILOT_FEEDBACK_STATUSES,
} from '#modules/pilot_feedback/interfaces/pilot_feedback_interface'

export const createPilotFeedbackValidator = vine.compile(
  vine.object({
    context: vine.enum(PILOT_FEEDBACK_CONTEXTS),
    rating: vine.number().min(1).max(5),
    message: vine.string().trim().minLength(3).maxLength(4000),
    organization_id: vine.number().min(1).optional(),
    establishment_id: vine.number().min(1).optional(),
  })
)

export const listPilotFeedbackValidator = vine.compile(
  vine.object({
    status: vine.enum(PILOT_FEEDBACK_STATUSES).optional(),
    context: vine.enum(PILOT_FEEDBACK_CONTEXTS).optional(),
    organization_id: vine.number().min(1).optional(),
    establishment_id: vine.number().min(1).optional(),
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
  })
)

export const reviewPilotFeedbackValidator = vine.compile(
  vine.object({
    status: vine.enum(['in_review', 'resolved', 'dismissed'] as const),
    internal_notes: vine.string().trim().minLength(1).maxLength(4000).nullable().optional(),
  })
)
