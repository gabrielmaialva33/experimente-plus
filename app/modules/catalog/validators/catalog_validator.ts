import vine from '@vinejs/vine'

import {
  CATALOG_DEFAULT_PAGE_SIZE,
  CATALOG_MAX_ATTRIBUTE_FILTERS,
  CATALOG_MAX_PAGE_SIZE,
  CATALOG_SORTS,
} from '#modules/catalog/interfaces/catalog_interface'

/**
 * Attribute keys are taxonomy-defined identifiers, not public slugs: they are
 * stored as free strings and commonly use snake_case. The charset stays narrow
 * so a malformed filter never reaches the projection or the cache identity.
 */
const attributeKey = () =>
  vine
    .string()
    .trim()
    .minLength(2)
    .maxLength(80)
    .regex(/^[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*$/)

const slug = () =>
  vine
    .string()
    .trim()
    .minLength(1)
    .maxLength(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

/**
 * Accepts both `attributes=a,b` and `attributes[]=a&attributes[]=b`, so a mobile
 * client can keep the filter state in a single, short query parameter.
 */
const attributeList = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined
  }

  const items = Array.isArray(value) ? value : String(value).split(',')
  const normalized = items
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => item !== '')

  return normalized.length > 0 ? normalized : undefined
}

export const catalogSearchValidator = vine.compile(
  vine.object({
    q: vine.string().trim().maxLength(120).optional(),
    category: slug().optional(),
    open_now: vine.boolean().optional(),
    attributes: vine
      .array(attributeKey())
      .parse(attributeList)
      .maxLength(CATALOG_MAX_ATTRIBUTE_FILTERS)
      .optional(),
    page: vine.number().withoutDecimals().min(1).optional(),
    per_page: vine.number().withoutDecimals().min(1).max(CATALOG_MAX_PAGE_SIZE).optional(),
    sort: vine.enum(CATALOG_SORTS).optional(),
  })
)

export const catalogDefaults = {
  page: 1,
  per_page: CATALOG_DEFAULT_PAGE_SIZE,
  sort: 'relevance' as const,
  open_now: false,
  attributes: [] as string[],
}
