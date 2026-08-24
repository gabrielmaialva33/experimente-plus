import vine from '@vinejs/vine'

import {
  MEDIA_MAX_ITEMS_PER_REVISION,
  MEDIA_MODERATION_STATUSES,
  MEDIA_PURPOSES,
} from '#modules/media/interfaces/media_interface'

const nullableText = (maximum: number) =>
  vine.string().trim().maxLength(maximum).nullable().optional()

export const createEstablishmentMediaValidator = vine.compile(
  vine.object({
    purpose: vine.enum(MEDIA_PURPOSES).optional(),
    is_cover: vine.boolean().optional(),
    alt_text: nullableText(180),
    caption: nullableText(500),
  })
)

export const updateEstablishmentMediaValidator = vine.compile(
  vine.object({
    purpose: vine.enum(MEDIA_PURPOSES).optional(),
    alt_text: nullableText(180),
    caption: nullableText(500),
  })
)

export const reorderEstablishmentMediaValidator = vine.compile(
  vine.object({
    media: vine
      .array(
        vine.object({
          id: vine.number().min(1),
          sort_order: vine
            .number()
            .min(0)
            .max(MEDIA_MAX_ITEMS_PER_REVISION - 1),
        })
      )
      .minLength(1)
      .maxLength(MEDIA_MAX_ITEMS_PER_REVISION),
  })
)

export const listMediaModerationValidator = vine.compile(
  vine.object({
    status: vine.enum(MEDIA_MODERATION_STATUSES).optional(),
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
  })
)

export const approveMediaValidator = vine.compile(
  vine.object({
    reason: nullableText(1000),
  })
)

export const rejectMediaValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(3).maxLength(1000),
  })
)
