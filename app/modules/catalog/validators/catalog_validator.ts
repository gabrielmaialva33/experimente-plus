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

const searchFields = {
  q: vine.string().trim().maxLength(120).optional(),
  category: slug().optional(),
  open_now: vine.boolean().optional(),
  benefit_today: vine.boolean().optional(),
  attributes: vine
    .array(attributeKey())
    .parse(attributeList)
    .maxLength(CATALOG_MAX_ATTRIBUTE_FILTERS)
    .optional(),
  page: vine.number().withoutDecimals().min(1).optional(),
  per_page: vine.number().withoutDecimals().min(1).max(CATALOG_MAX_PAGE_SIZE).optional(),
  sort: vine.enum(CATALOG_SORTS).optional(),
}

/**
 * The public search API. `lat` and `lng` exist only for `sort=distance`, which
 * refuses to run without both; with any other order they are dropped unread.
 */
export const catalogSearchValidator = vine.compile(
  vine.object({
    ...searchFields,
    lat: vine
      .number()
      .min(-90)
      .max(90)
      .optional()
      .requiredWhen('sort', '=', 'distance')
      .requiredIfExists('lng'),
    lng: vine
      .number()
      .min(-180)
      .max(180)
      .optional()
      .requiredWhen('sort', '=', 'distance')
      .requiredIfExists('lat'),
  })
)

/**
 * The catalogue pages. A page URL is shared, bookmarked and kept in history, so
 * it never carries coordinates: there is no `lat` or `lng` here, and the pages
 * read `sort=distance` as relevance (the web asks the API for the nearest
 * places itself, with the visitor's position in that request alone).
 */
export const catalogPageSearchValidator = vine.compile(vine.object(searchFields))

export const catalogDefaults = {
  page: 1,
  per_page: CATALOG_DEFAULT_PAGE_SIZE,
  sort: 'relevance' as const,
  open_now: false,
  benefit_today: false,
  attributes: [] as string[],
}
