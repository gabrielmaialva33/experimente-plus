import vine from '@vinejs/vine'

import {
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_MAX_BATCH_SIZE,
} from '#modules/analytics/interfaces/analytics_interface'

const slug = vine
  .string()
  .trim()
  .minLength(1)
  .maxLength(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const date = vine
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)

const uuid = vine
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)

export const ingestAnalyticsEventsValidator = vine.compile(
  vine.object({
    events: vine
      .array(
        vine.object({
          event_id: uuid,
          event_type: vine.enum(ANALYTICS_EVENT_TYPES),
          city_slug: slug,
          establishment_slug: slug.optional(),
          category_slug: slug.optional(),
          search_term: vine.string().trim().minLength(1).maxLength(120).optional(),
        })
      )
      .minLength(1)
      .maxLength(ANALYTICS_MAX_BATCH_SIZE),
  })
)

export const analyticsDateRangeValidator = vine.compile(
  vine.object({
    from: date.optional(),
    to: date.optional(),
    establishment_id: vine.number().min(1).optional(),
  })
)

export const adminSearchAnalyticsValidator = vine.compile(
  vine.object({
    from: date.optional(),
    to: date.optional(),
    city_id: vine.number().min(1).optional(),
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(100).optional(),
  })
)
