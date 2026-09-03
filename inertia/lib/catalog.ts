export type JsonRecord = Record<string, unknown>

export type CatalogBusinessStatus = 'open' | 'temporarily_closed' | 'permanently_closed'
export type CatalogAvailability = 'regular_hours' | 'appointment_only' | 'always_open'
export type CatalogSort = 'relevance' | 'name' | 'recent'

export interface CatalogCity {
  slug: string
  name: string
  stateCode: string | null
  countryCode: string | null
  timezone: string | null
  regionName: string | null
  establishmentsCount: number
}

export interface CatalogCategory {
  slug: string
  name: string
  description: string | null
  icon: string | null
  parentSlug: string | null
  familyName: string | null
  establishmentsCount: number
  isPrimary: boolean
}

export interface CatalogCitySummary {
  slug: string
  name: string
  stateCode: string
  timezone: string
}

export interface CatalogCategorySummary {
  slug: string
  name: string
  description: string | null
  icon: string | null
  parentSlug: string | null
  family: {
    slug: string
    name: string
    icon: string | null
  }
}

export interface CatalogMedia {
  url: string
  altText: string
  caption: string | null
  width: number | null
  height: number | null
  isCover: boolean
  purpose: string | null
}

export interface CatalogSearchItem {
  slug: string
  name: string
  shortDescription: string | null
  citySlug: string
  cityName: string
  stateCode: string | null
  district: string | null
  businessStatus: CatalogBusinessStatus
  isOpenNow: boolean
  primaryCategory: CatalogCategory | null
  categories: CatalogCategory[]
  cover: CatalogMedia | null
  isSponsored: boolean
}

export interface CatalogSearchMeta {
  total: number
  page: number
  perPage: number
  lastPage: number
}

export interface CatalogSearchQuery {
  q: string
  category: string | null
  openNow: boolean
  sort: CatalogSort
}

export interface CatalogSearchResult {
  context: {
    city: CatalogCitySummary
    category: CatalogCategorySummary | null
  }
  sponsored: CatalogSearchItem[]
  organic: CatalogSearchItem[]
  meta: CatalogSearchMeta
  query: CatalogSearchQuery
}

export interface CatalogAddress {
  postalCode: string | null
  street: string | null
  number: string | null
  withoutNumber: boolean
  complement: string | null
  district: string | null
  reference: string | null
  latitude: number | null
  longitude: number | null
}

export interface CatalogContact {
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  instagram: string | null
  bookingUrl: string | null
}

export interface CatalogAttribute {
  key: string
  name: string
  description: string | null
  type: string
  unit: string | null
  value: string | number | boolean | null
  options: Array<{ label: string; value: string }>
}

export interface CatalogHour {
  weekday: number
  opensAt: string
  closesAt: string
  spansNextDay: boolean
  sortOrder: number
}

export interface CatalogSpecialDay {
  date: string
  status: 'closed' | 'custom_hours'
  note: string | null
  intervals: CatalogHour[]
}

export interface CatalogDetail {
  historical: false
  slug: string
  name: string
  shortDescription: string | null
  description: string | null
  city: CatalogCity
  address: CatalogAddress
  contacts: CatalogContact
  businessStatus: CatalogBusinessStatus
  availabilityType: CatalogAvailability
  isOpenNow: boolean
  categories: CatalogCategory[]
  attributes: CatalogAttribute[]
  weeklyHours: CatalogHour[]
  specialDays: CatalogSpecialDay[]
  media: CatalogMedia[]
  cover: CatalogMedia | null
  isSponsored: boolean
  publishedAt: string | null
  updatedAt: string | null
}

export interface CatalogHistoricalDetail {
  historical: true
  slug: string
  name: string
  city: CatalogCity
  businessStatus: 'permanently_closed'
  message: string
  publishedAt: string | null
  updatedAt: string | null
}

export function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

export function recordValue(record: JsonRecord | null, ...keys: string[]): JsonRecord | null {
  if (!record) return null

  for (const key of keys) {
    const value = asRecord(record[key])
    if (value) return value
  }

  return null
}

export function collection(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(asRecord).filter((item): item is JsonRecord => !!item)

  const record = asRecord(value)
  if (!record) return []

  for (const key of [
    'data',
    'items',
    'results',
    'cities',
    'categories',
    'establishments',
    'organic_results',
  ]) {
    if (Array.isArray(record[key])) {
      return (record[key] as unknown[]).map(asRecord).filter((item): item is JsonRecord => !!item)
    }
  }

  return []
}

export function recordsAt(record: JsonRecord | null, key: string): JsonRecord[] {
  if (!record || !Array.isArray(record[key])) return []
  return (record[key] as unknown[]).map(asRecord).filter((item): item is JsonRecord => !!item)
}

export function firstRecord(value: unknown): JsonRecord | null {
  const direct = asRecord(value)
  if (direct && !('data' in direct)) return direct

  return collection(value)[0] ?? recordValue(direct, 'data')
}

export function stringValue(record: JsonRecord | null, ...keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function dateTimeStringValue(record: JsonRecord | null, ...keys: string[]): string | null {
  if (!record) return null

  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value.trim()) return value.trim()

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString()
    }

    if (value !== null && typeof value === 'object') {
      const toISO = (value as { toISO?: unknown }).toISO

      if (typeof toISO === 'function') {
        const serialized = toISO.call(value)
        if (typeof serialized === 'string' && serialized.trim()) return serialized.trim()
      }
    }
  }

  return null
}

export function numberValue(record: JsonRecord | null, ...keys: string[]): number | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return null
}

export function booleanValue(record: JsonRecord | null, ...keys: string[]): boolean | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (value === 'true' || value === 1 || value === '1') return true
    if (value === 'false' || value === 0 || value === '0') return false
  }
  return null
}

type NullableStringField = { valid: true; value: string | null } | { valid: false }

function nullableStringField(record: JsonRecord | null, key: string): NullableStringField {
  if (!record || !Object.prototype.hasOwnProperty.call(record, key)) return { valid: false }

  const value = record[key]
  if (value === null) return { valid: true, value: null }
  if (typeof value === 'string' && value.trim()) return { valid: true, value: value.trim() }

  return { valid: false }
}

export function coverUrl(record: JsonRecord | null): string | null {
  if (!record) return null
  const direct = stringValue(record, 'cover_url', 'image_url', 'url')
  if (direct) return direct

  const cover = recordValue(record, 'cover', 'cover_image', 'media')
  const asset = recordValue(cover, 'asset')
  return stringValue(asset, 'url') ?? stringValue(cover, 'url')
}

export function metadata(value: unknown): JsonRecord | null {
  const record = asRecord(value)
  return recordValue(record, 'meta', 'pagination')
}

function normalizedBusinessStatus(value: string | null): CatalogBusinessStatus {
  if (value === 'temporarily_closed' || value === 'permanently_closed') return value
  return 'open'
}

function normalizedAvailability(value: string | null): CatalogAvailability {
  if (value === 'appointment_only' || value === 'always_open') return value
  return 'regular_hours'
}

function normalizedSort(value: string | null): CatalogSort {
  if (value === 'name' || value === 'recent') return value
  return 'relevance'
}

function parseCity(value: unknown): CatalogCity | null {
  const city = asRecord(value)
  const slug = stringValue(city, 'slug', 'city_slug')
  const name = stringValue(city, 'name', 'city_name')
  if (!slug || !name) return null
  const region = recordValue(city, 'region')

  return {
    slug,
    name,
    stateCode: stringValue(city, 'state_code', 'state', 'uf'),
    countryCode: stringValue(city, 'country_code'),
    timezone: stringValue(city, 'timezone'),
    regionName: stringValue(region, 'name') ?? stringValue(city, 'region_name'),
    establishmentsCount: numberValue(city, 'establishments_count', 'count', 'total') ?? 0,
  }
}

export function catalogCity(value: unknown): CatalogCity | null {
  return parseCity(value)
}

function parseCitySummary(value: unknown): CatalogCitySummary | null {
  const city = asRecord(value)
  const slug = stringValue(city, 'slug')
  const name = stringValue(city, 'name')
  const stateCode = stringValue(city, 'state_code')
  const timezone = stringValue(city, 'timezone')

  if (!slug || !name || !stateCode || !timezone) return null

  return { slug, name, stateCode, timezone }
}

function parseCategory(value: unknown): CatalogCategory | null {
  const category = asRecord(value)
  const slug = stringValue(category, 'slug', 'category_slug')
  const name = stringValue(category, 'name', 'category_name')
  if (!slug || !name) return null
  const family = recordValue(category, 'family')

  return {
    slug,
    name,
    description: stringValue(category, 'description'),
    icon: stringValue(category, 'icon'),
    parentSlug: stringValue(category, 'parent_slug'),
    familyName: stringValue(family, 'name') ?? stringValue(category, 'family_name'),
    establishmentsCount: numberValue(category, 'establishments_count', 'count', 'total') ?? 0,
    isPrimary: booleanValue(category, 'is_primary') ?? false,
  }
}

export function catalogCategory(value: unknown): CatalogCategory | null {
  return parseCategory(value)
}

function parseCategorySummary(value: unknown): CatalogCategorySummary | null {
  const category = asRecord(value)
  const family = recordValue(category, 'family')
  const slug = stringValue(category, 'slug')
  const name = stringValue(category, 'name')
  const familySlug = stringValue(family, 'slug')
  const familyName = stringValue(family, 'name')
  const description = nullableStringField(category, 'description')
  const icon = nullableStringField(category, 'icon')
  const parentSlug = nullableStringField(category, 'parent_slug')
  const familyIcon = nullableStringField(family, 'icon')

  if (
    !slug ||
    !name ||
    !familySlug ||
    !familyName ||
    !description.valid ||
    !icon.valid ||
    !parentSlug.valid ||
    !familyIcon.valid
  ) {
    return null
  }

  return {
    slug,
    name,
    description: description.value,
    icon: icon.value,
    parentSlug: parentSlug.value,
    family: {
      slug: familySlug,
      name: familyName,
      icon: familyIcon.value,
    },
  }
}

function parseMedia(value: unknown): CatalogMedia | null {
  const media = asRecord(value)
  if (!media) return null
  const asset = recordValue(media, 'asset')
  const url = stringValue(asset, 'url') ?? stringValue(media, 'url')
  if (!url) return null

  return {
    url,
    altText: stringValue(media, 'alt_text') ?? 'Imagem do estabelecimento',
    caption: stringValue(media, 'caption'),
    width: numberValue(asset, 'width') ?? numberValue(media, 'width'),
    height: numberValue(asset, 'height') ?? numberValue(media, 'height'),
    isCover: booleanValue(media, 'is_cover') ?? false,
    purpose: stringValue(media, 'purpose'),
  }
}

function parseSearchItem(value: unknown, sponsored = false): CatalogSearchItem | null {
  const item = asRecord(value)
  if (!item) return null
  const slug = stringValue(item, 'slug', 'establishment_slug')
  const name = stringValue(item, 'name', 'public_name')
  if (!slug || !name) return null
  const city = parseCity(recordValue(item, 'city'))
  if (!city) return null
  const address = recordValue(item, 'address')
  const categories = recordsAt(item, 'categories').flatMap((category) => {
    const parsed = parseCategory(category)
    return parsed ? [parsed] : []
  })
  const primary =
    parseCategory(recordValue(item, 'primary_category')) ??
    categories.find((c) => c.isPrimary) ??
    null

  return {
    slug,
    name,
    shortDescription: stringValue(item, 'short_description', 'description'),
    citySlug: city.slug,
    cityName: city.name,
    stateCode: city.stateCode,
    district: stringValue(address, 'district', 'neighborhood'),
    businessStatus: normalizedBusinessStatus(stringValue(item, 'business_status')),
    isOpenNow: booleanValue(item, 'is_open_now', 'open_now') ?? false,
    primaryCategory: primary,
    categories,
    cover: parseMedia(recordValue(item, 'cover', 'cover_image', 'media')),
    isSponsored: booleanValue(item, 'is_sponsored') ?? sponsored,
  }
}

export function catalogCities(value: unknown): CatalogCity[] {
  return collection(value).flatMap((city) => {
    const parsed = parseCity(city)
    return parsed ? [parsed] : []
  })
}

export function catalogCategories(value: unknown): {
  city: CatalogCitySummary
  categories: CatalogCategory[]
} {
  const record = asRecord(value)
  const city = parseCitySummary(recordValue(record, 'city'))

  if (!city) {
    throw new TypeError('Catalog categories response is missing its canonical city')
  }

  return {
    city,
    categories: recordsAt(record, 'categories').flatMap((category) => {
      const parsed = parseCategory(category)
      return parsed ? [parsed] : []
    }),
  }
}

export function catalogSearch(value: unknown): CatalogSearchResult {
  const record = asRecord(value)
  const context = recordValue(record, 'context')
  const meta = recordValue(record, 'meta')
  const query = recordValue(record, 'query')
  const city = parseCitySummary(recordValue(context, 'city'))

  if (!city) {
    throw new TypeError('Catalog search response is missing its canonical city')
  }

  if (!context || !Object.prototype.hasOwnProperty.call(context, 'category')) {
    throw new TypeError('Catalog search response is missing its canonical category context')
  }

  const rawCategory = context.category
  const category = rawCategory === null ? null : parseCategorySummary(rawCategory)

  if (rawCategory !== null && !category) {
    throw new TypeError('Catalog search response has an invalid canonical category context')
  }

  return {
    context: {
      city,
      category,
    },
    sponsored: recordsAt(record, 'sponsored_results').flatMap((item) => {
      const parsed = parseSearchItem(item, true)
      return parsed ? [parsed] : []
    }),
    organic: recordsAt(record, 'organic_results').flatMap((item) => {
      const parsed = parseSearchItem(item)
      return parsed ? [parsed] : []
    }),
    meta: {
      total: numberValue(meta, 'total') ?? 0,
      page: Math.max(1, numberValue(meta, 'page') ?? 1),
      perPage: Math.max(1, numberValue(meta, 'per_page') ?? 20),
      lastPage: Math.max(1, numberValue(meta, 'last_page') ?? 1),
    },
    query: {
      q: stringValue(query, 'q') ?? '',
      category: stringValue(query, 'category'),
      openNow: booleanValue(query, 'open_now') ?? false,
      sort: normalizedSort(stringValue(query, 'sort')),
    },
  }
}

function parseAddress(value: unknown): CatalogAddress {
  const address = asRecord(value)
  return {
    postalCode: stringValue(address, 'postal_code'),
    street: stringValue(address, 'street', 'street_name'),
    number: stringValue(address, 'number'),
    withoutNumber: booleanValue(address, 'without_number') ?? false,
    complement: stringValue(address, 'complement'),
    district: stringValue(address, 'district', 'neighborhood'),
    reference: stringValue(address, 'reference'),
    latitude: numberValue(address, 'latitude'),
    longitude: numberValue(address, 'longitude'),
  }
}

function parseHour(value: unknown): CatalogHour | null {
  const hour = asRecord(value)
  if (!hour) return null
  const weekday = numberValue(hour, 'weekday')
  const opensAt = stringValue(hour, 'opens_at', 'opens')
  const closesAt = stringValue(hour, 'closes_at', 'closes')
  if (weekday === null || !opensAt || !closesAt) return null

  return {
    weekday,
    opensAt: opensAt.slice(0, 5),
    closesAt: closesAt.slice(0, 5),
    spansNextDay: booleanValue(hour, 'spans_next_day') ?? false,
    sortOrder: numberValue(hour, 'sort_order') ?? 0,
  }
}

function parseAttribute(value: unknown): CatalogAttribute | null {
  const attribute = asRecord(value)
  const key = stringValue(attribute, 'key')
  const name = stringValue(attribute, 'name')
  if (!key || !name) return null
  const rawValue = attribute?.value
  const options = recordsAt(attribute, 'options').flatMap((option) => {
    const label = stringValue(option, 'label')
    const optionValue = stringValue(option, 'value')
    return label && optionValue ? [{ label, value: optionValue }] : []
  })

  return {
    key,
    name,
    description: stringValue(attribute, 'description'),
    type: stringValue(attribute, 'type') ?? 'text',
    unit: stringValue(attribute, 'unit'),
    value:
      typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean'
        ? rawValue
        : null,
    options,
  }
}

export function catalogDetail(value: unknown): CatalogDetail | CatalogHistoricalDetail | null {
  const detail = firstRecord(value)
  if (!detail) return null
  const slug = stringValue(detail, 'slug', 'establishment_slug')
  const name = stringValue(detail, 'name', 'public_name')
  if (!slug || !name) return null

  const city = parseCity(recordValue(detail, 'city'))
  if (!city) return null

  const businessStatus = normalizedBusinessStatus(stringValue(detail, 'business_status'))
  if (booleanValue(detail, 'historical') || businessStatus === 'permanently_closed') {
    return {
      historical: true,
      slug,
      name,
      city,
      businessStatus: 'permanently_closed',
      message:
        stringValue(detail, 'message') ??
        'Este estabelecimento encerrou permanentemente as atividades.',
      publishedAt: dateTimeStringValue(detail, 'published_at'),
      updatedAt: dateTimeStringValue(detail, 'updated_at'),
    }
  }

  const contacts = recordValue(detail, 'contacts')
  const openingHours = recordValue(detail, 'opening_hours')
  const media = recordsAt(detail, 'media').flatMap((item) => {
    const parsed = parseMedia(item)
    return parsed ? [parsed] : []
  })
  const cover =
    parseMedia(recordValue(detail, 'cover')) ?? media.find((item) => item.isCover) ?? null

  return {
    historical: false,
    slug,
    name,
    shortDescription: stringValue(detail, 'short_description'),
    description: stringValue(detail, 'description'),
    city,
    address: parseAddress(recordValue(detail, 'address')),
    contacts: {
      phone: stringValue(contacts, 'phone'),
      whatsapp: stringValue(contacts, 'whatsapp'),
      email: stringValue(contacts, 'email'),
      website: stringValue(contacts, 'website'),
      instagram: stringValue(contacts, 'instagram'),
      bookingUrl: stringValue(contacts, 'booking_url'),
    },
    businessStatus,
    availabilityType: normalizedAvailability(stringValue(detail, 'availability_type')),
    isOpenNow: booleanValue(detail, 'is_open_now', 'open_now') ?? false,
    categories: recordsAt(detail, 'categories').flatMap((category) => {
      const parsed = parseCategory(category)
      return parsed ? [parsed] : []
    }),
    attributes: recordsAt(detail, 'attributes').flatMap((attribute) => {
      const parsed = parseAttribute(attribute)
      return parsed ? [parsed] : []
    }),
    weeklyHours: recordsAt(openingHours, 'weekly').flatMap((hour) => {
      const parsed = parseHour(hour)
      return parsed ? [parsed] : []
    }),
    specialDays: recordsAt(openingHours, 'special_days').flatMap((day) => {
      const date = stringValue(day, 'date')
      const status = stringValue(day, 'status')
      if (!date || (status !== 'closed' && status !== 'custom_hours')) return []
      return [
        {
          date,
          status,
          note: stringValue(day, 'note'),
          intervals: recordsAt(day, 'intervals').flatMap((interval) => {
            const parsed = parseHour({ ...interval, weekday: 0 })
            return parsed ? [parsed] : []
          }),
        },
      ]
    }),
    media,
    cover,
    isSponsored: booleanValue(detail, 'is_sponsored') ?? false,
    publishedAt: dateTimeStringValue(detail, 'published_at'),
    updatedAt: dateTimeStringValue(detail, 'updated_at'),
  }
}

export function businessStatusLabel(status: CatalogBusinessStatus, isOpenNow: boolean): string {
  if (status === 'permanently_closed') return 'Encerrado permanentemente'
  if (status === 'temporarily_closed') return 'Fechado temporariamente'
  return isOpenNow ? 'Aberto agora' : 'Fechado agora'
}

export function availabilityLabel(value: CatalogAvailability): string {
  if (value === 'always_open') return 'Atendimento 24 horas'
  if (value === 'appointment_only') return 'Somente com agendamento'
  return 'Horários regulares'
}

export function weekdayLabel(value: number): string {
  return (
    [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ][value] ?? `Dia ${value}`
  )
}

export function formatCatalogAddress(address: CatalogAddress): string {
  const street = [address.street, address.withoutNumber ? 's/n' : address.number]
    .filter(Boolean)
    .join(', ')
  return [street, address.district].filter(Boolean).join(' — ')
}

export function pageHref(
  path: string,
  query: CatalogSearchQuery,
  page: number,
  perPage?: number
): string {
  const parameters = new URLSearchParams()
  if (query.q) parameters.set('q', query.q)
  if (query.category) parameters.set('category', query.category)
  if (query.openNow) parameters.set('open_now', 'true')
  if (query.sort !== 'relevance') parameters.set('sort', query.sort)
  if (perPage && perPage !== 20) parameters.set('per_page', String(perPage))
  if (page > 1) parameters.set('page', String(page))
  const serialized = parameters.toString()
  return serialized ? `${path}?${serialized}` : path
}
