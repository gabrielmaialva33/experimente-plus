import vine from '@vinejs/vine'

import IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'

/**
 * The kind travels in the path, so it is validated like any other parameter
 * rather than trusted because a route matched it.
 */
export const contentKindParamsValidator = vine.compile(
  vine.object({
    kind: vine.enum(IPartnerContent.CANONICAL_CONTENT_PATHS),
  })
)

export const contentIdParamsValidator = vine.compile(
  vine.object({
    kind: vine.enum(IPartnerContent.CANONICAL_CONTENT_PATHS),
    id: vine.number().min(1),
  })
)

export const publicContentParamsValidator = vine.compile(
  vine.object({
    kind: vine.enum(IPartnerContent.CANONICAL_CONTENT_PATHS),
    establishmentId: vine.number().min(1),
  })
)

export const createContentValidator = vine.compile(
  vine.object({
    establishment_id: vine.number().min(1),
    title: vine.string().trim().minLength(1).maxLength(180),
    description: vine.string().trim().maxLength(4000).nullable().optional(),
    starts_at: vine.string().trim().optional(),
    ends_at: vine.string().trim().optional(),
    // Displayed, never charged: there is no purchase path that accepts a
    // showcase item as a product (ADR-0028).
    informational_price_cents: vine.number().withoutDecimals().min(0).nullable().optional(),
  })
)

export const updateContentValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(180).optional(),
    description: vine.string().trim().maxLength(4000).nullable().optional(),
    starts_at: vine.string().trim().optional(),
    ends_at: vine.string().trim().optional(),
    informational_price_cents: vine.number().withoutDecimals().min(0).nullable().optional(),
  })
)

export const listContentQueryValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
    status: vine.enum(IPartnerContent.CANONICAL_CONTENT_STATUSES).optional(),
    establishment_id: vine.number().min(1).optional(),
  })
)

export const updatePartnerContentPolicyValidator = vine.compile(
  vine.object({
    require_experience_approval: vine.boolean().optional(),
    require_event_approval: vine.boolean().optional(),
    require_showcase_item_approval: vine.boolean().optional(),
    max_media_per_content: vine.number().withoutDecimals().min(0).optional(),
    min_event_notice_minutes: vine.number().withoutDecimals().min(0).optional(),
  })
)
