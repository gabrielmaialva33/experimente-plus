import vine from '@vinejs/vine'

import {
  CATALOG_DEFAULT_PAGE_SIZE,
  CATALOG_MAX_PAGE_SIZE,
  CATALOG_SORTS,
} from '#modules/catalog/interfaces/catalog_interface'

const slug = () =>
  vine
    .string()
    .trim()
    .minLength(1)
    .maxLength(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const catalogSearchValidator = vine.compile(
  vine.object({
    q: vine.string().trim().maxLength(120).optional(),
    category: slug().optional(),
    open_now: vine.boolean().optional(),
    page: vine.number().min(1).optional(),
    per_page: vine.number().min(1).max(CATALOG_MAX_PAGE_SIZE).optional(),
    sort: vine.enum(CATALOG_SORTS).optional(),
  })
)

export const catalogDefaults = {
  page: 1,
  per_page: CATALOG_DEFAULT_PAGE_SIZE,
  sort: 'relevance' as const,
  open_now: false,
}
