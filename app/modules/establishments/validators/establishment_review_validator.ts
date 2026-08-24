import vine from '@vinejs/vine'

import { ESTABLISHMENT_REVIEW_ISSUE_SEVERITIES } from '#modules/establishments/interfaces/establishment_review_interface'

const optionalReason = vine.string().trim().maxLength(1000).nullable().optional()

export const createEstablishmentRevisionValidator = vine.compile(
  vine.object({
    source: vine.enum(['published', 'latest_terminal'] as const).optional(),
  })
)

export const listEstablishmentReviewQueueValidator = vine.compile(
  vine.object({
    organization_id: vine.number().min(1).optional(),
    city_id: vine.number().min(1).optional(),
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
  })
)

export const approveEstablishmentRevisionValidator = vine.compile(
  vine.object({
    reason: optionalReason,
  })
)

export const rejectEstablishmentRevisionValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(3).maxLength(1000),
  })
)

export const requestEstablishmentRevisionChangesValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(3).maxLength(1000),
    issues: vine
      .array(
        vine.object({
          code: vine
            .string()
            .trim()
            .regex(/^[a-z][a-z0-9_]{1,79}$/),
          field: vine.string().trim().minLength(1).maxLength(160),
          message: vine.string().trim().minLength(3).maxLength(1000),
          severity: vine.enum(ESTABLISHMENT_REVIEW_ISSUE_SEVERITIES),
        })
      )
      .minLength(1)
      .maxLength(50),
  })
)

export const suspendEstablishmentValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(3).maxLength(1000),
  })
)

export const restoreEstablishmentValidator = vine.compile(
  vine.object({
    reason: optionalReason,
  })
)
