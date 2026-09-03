export const CATALOG_SORTS = ['relevance', 'name', 'recent'] as const
export const CATALOG_MAX_PAGE_SIZE = 50
export const CATALOG_DEFAULT_PAGE_SIZE = 20
export const CATALOG_PROJECTION_VERSION = 1

export namespace ICatalog {
  export type Sort = (typeof CATALOG_SORTS)[number]
  export type BusinessStatus = 'open' | 'temporarily_closed' | 'permanently_closed'
  export type AvailabilityType = 'regular_hours' | 'appointment_only' | 'always_open'

  export interface SearchQuery {
    q: string
    category?: string
    open_now: boolean
    page: number
    per_page: number
    sort: Sort
  }

  export interface CityRow {
    id: number
    slug: string
    name: string
    state_code: string
    country_code: string
    timezone: string
    latitude: number | null
    longitude: number | null
    region_slug: string
    region_name: string
    establishments_count: number
  }

  export interface CityProjection {
    slug: string
    name: string
    state_code: string
    country_code: string
    timezone: string
    coordinates: {
      latitude: number | null
      longitude: number | null
    }
    region: {
      slug: string
      name: string
    }
    establishments_count: number
  }

  export interface CategoryRow {
    id: number
    slug: string
    name: string
    description: string | null
    icon: string | null
    parent_slug: string | null
    family_slug: string
    family_name: string
    family_icon: string | null
    establishments_count: number
  }

  export interface CategoryProjection {
    slug: string
    name: string
    description: string | null
    icon: string | null
    parent_slug: string | null
    family: {
      slug: string
      name: string
      icon: string | null
    }
    establishments_count: number
  }

  export interface CategoryIdentityRow {
    slug: string
    name: string
    description: string | null
    icon: string | null
    parent_slug: string | null
    family_slug: string
    family_name: string
    family_icon: string | null
  }

  export interface CategoryIdentityProjection {
    slug: string
    name: string
    description: string | null
    icon: string | null
    parent_slug: string | null
    family: {
      slug: string
      name: string
      icon: string | null
    }
  }

  export interface AddressProjection {
    postal_code: string | null
    street: string | null
    number: string | null
    without_number: boolean
    complement: string | null
    district: string | null
    reference: string | null
    latitude: number | null
    longitude: number | null
  }

  export interface CategoryItem {
    slug: string
    name: string
    description: string | null
    icon: string | null
    family: {
      slug: string
      name: string
      icon: string | null
    }
    is_primary: boolean
    sort_order: number
  }

  export interface AttributeOptionItem {
    label: string
    value: string
  }

  export interface AttributeItem {
    key: string
    name: string
    description: string | null
    type: string
    unit: string | null
    value: string | number | boolean | null
    options: AttributeOptionItem[]
  }

  export interface HourItem {
    weekday: number
    opens_at: string
    closes_at: string
    spans_next_day: boolean
    sort_order: number
  }

  export interface SpecialHourItem {
    opens_at: string
    closes_at: string
    spans_next_day: boolean
    sort_order: number
  }

  export interface SpecialDayItem {
    date: string
    status: 'closed' | 'custom_hours'
    note: string | null
    intervals: SpecialHourItem[]
  }

  export interface MediaItem {
    purpose: string
    is_cover: boolean
    sort_order: number
    alt_text: string
    caption: string | null
    asset: {
      url: string
      mime_type: string
      file_extension: string
      width: number
      height: number
    }
  }

  export interface CatalogRow {
    establishment_id: number
    tenant_id: number
    organization_id: number
    published_revision_id: number
    city_id: number
    city_slug: string
    city_name: string
    city_state_code: string
    city_timezone: string
    establishment_slug: string
    public_name: string
    short_description: string | null
    description: string | null
    public_phone: string | null
    whatsapp: string | null
    public_email: string | null
    website: string | null
    instagram: string | null
    booking_url: string | null
    business_status: BusinessStatus
    availability_type: AvailabilityType
    address: AddressProjection
    latitude: number | null
    longitude: number | null
    categories: CategoryItem[]
    public_attributes: AttributeItem[]
    weekly_hours: HourItem[]
    special_days: SpecialDayItem[]
    media: MediaItem[]
    cover_media: MediaItem | null
    is_discoverable: boolean
    is_sponsored: boolean
    sponsored_priority: number | null
    published_at: string
    public_updated_at: string
    is_open_now: boolean
    relevance_score: number
    total_count: number
  }

  export interface SearchItemProjection {
    slug: string
    name: string
    short_description: string | null
    city: {
      slug: string
      name: string
      state_code: string
    }
    address: {
      district: string | null
      latitude: number | null
      longitude: number | null
    }
    business_status: BusinessStatus
    is_open_now: boolean
    primary_category: CategoryItem | null
    categories: CategoryItem[]
    cover: MediaItem
    is_sponsored: boolean
    published_at: string
    updated_at: string
  }

  export interface SearchResult {
    context: {
      city: Pick<CityProjection, 'slug' | 'name' | 'state_code' | 'timezone'>
      category: CategoryIdentityProjection | null
    }
    meta: {
      total: number
      page: number
      per_page: number
      last_page: number
      first_page: number
      first_page_url: string
      last_page_url: string
      next_page_url: string | null
      previous_page_url: string | null
    }
    query: {
      q: string | null
      category: string | null
      open_now: boolean
      sort: Sort
    }
    sponsored_results: SearchItemProjection[]
    organic_results: SearchItemProjection[]
  }

  export interface DetailProjection {
    slug: string
    name: string
    short_description: string | null
    description: string | null
    city: {
      slug: string
      name: string
      state_code: string
      timezone: string
    }
    address: AddressProjection
    contacts: {
      phone: string | null
      whatsapp: string | null
      email: string | null
      website: string | null
      instagram: string | null
      booking_url: string | null
    }
    business_status: BusinessStatus
    availability_type: AvailabilityType
    is_open_now: boolean
    categories: CategoryItem[]
    attributes: AttributeItem[]
    opening_hours: {
      weekly: HourItem[]
      special_days: SpecialDayItem[]
    }
    media: MediaItem[]
    cover: MediaItem
    is_sponsored: boolean
    published_at: string
    updated_at: string
  }

  export interface HistoricalProjection {
    slug: string
    name: string
    city: {
      slug: string
      name: string
      state_code: string
    }
    business_status: 'permanently_closed'
    historical: true
    message: string
    published_at: string
    updated_at: string
  }
}

export default ICatalog
