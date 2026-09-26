import vine from '@vinejs/vine'

import IConcierge from '#modules/concierge/interfaces/concierge_interface'

/**
 * The question is free text from a consumer and the only thing that leaves the
 * operation besides the catalogue excerpt, so its size is bounded here rather
 * than trusted to the provider — ADR-0029.
 */
export const conciergeAskValidator = vine.compile(
  vine.object({
    question: vine.string().trim().minLength(3).maxLength(300),
    city: vine.string().trim().toLowerCase().maxLength(120).optional(),
  })
)

const { max_catalog_items: items, daily_questions_per_person: daily } = IConcierge.POLICY_RANGES

/**
 * The operation's Concierge parameters. Every field is optional, so the API
 * and the screen can change one value alone; the ranges are the table's.
 */
export const updateConciergePolicyValidator = vine.compile(
  vine.object({
    enabled: vine.boolean().optional(),
    max_catalog_items: vine.number().withoutDecimals().min(items.min).max(items.max).optional(),
    daily_questions_per_person: vine
      .number()
      .withoutDecimals()
      .min(daily.min)
      .max(daily.max)
      .optional(),
  })
)
