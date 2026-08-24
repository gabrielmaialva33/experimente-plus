export const ANALYTICS_EVENT_TYPES = [
  'catalog_impression',
  'establishment_view',
  'route_click',
  'whatsapp_click',
  'phone_click',
  'website_click',
  'share_click',
  'search_without_results',
] as const

export const ANALYTICS_ESTABLISHMENT_EVENT_TYPES = [
  'catalog_impression',
  'establishment_view',
  'route_click',
  'whatsapp_click',
  'phone_click',
  'website_click',
  'share_click',
] as const

export const ANALYTICS_EXTERNAL_ACTIONS = ['route', 'whatsapp', 'phone', 'website'] as const
export const ANALYTICS_SOURCES = ['web', 'redirect', 'server'] as const
export const ANALYTICS_MAX_BATCH_SIZE = 20
export const ANALYTICS_SESSION_COOKIE = 'experimente_analytics_session'

export const ANALYTICS_ACTION_EVENT = {
  route: 'route_click',
  whatsapp: 'whatsapp_click',
  phone: 'phone_click',
  website: 'website_click',
} as const

export namespace IAnalytics {
  export type EventType = (typeof ANALYTICS_EVENT_TYPES)[number]
  export type EstablishmentEventType = (typeof ANALYTICS_ESTABLISHMENT_EVENT_TYPES)[number]
  export type ExternalAction = (typeof ANALYTICS_EXTERNAL_ACTIONS)[number]
  export type Source = (typeof ANALYTICS_SOURCES)[number]

  export interface PublicEventInput {
    event_id: string
    event_type: EventType
    city_slug: string
    establishment_slug?: string
    category_slug?: string
    search_term?: string
  }

  export interface BatchInput {
    events: PublicEventInput[]
  }

  export interface CatalogTarget {
    tenant_id: number
    establishment_id: number
    published_revision_id: number
    city_id: number
    city_slug: string
    city_timezone: string
    establishment_slug: string
    business_status: 'open' | 'temporarily_closed' | 'permanently_closed'
    is_discoverable: boolean
    public_phone: string | null
    whatsapp: string | null
    website: string | null
    latitude: number | null
    longitude: number | null
  }

  export interface CityTarget {
    tenant_id: number
    city_id: number
    city_slug: string
    city_timezone: string
  }

  export interface ResolvedEvent {
    event_id: string
    event_type: EventType
    source: Source
    target: CatalogTarget | CityTarget
    category_slug: string | null
    search_term_redacted: string | null
    search_term_hash: string | null
  }

  export interface RecordResult {
    event_id: string
    recorded: boolean
    deduplicated: boolean
  }

  export interface BatchResult {
    accepted: number
    recorded: number
    deduplicated: number
    events: RecordResult[]
  }

  export interface DateRangeQuery {
    from?: string
    to?: string
    establishment_id?: number
  }

  export interface AdminSearchQuery {
    from?: string
    to?: string
    city_id?: number
    page?: number
    per_page?: number
  }

  export interface MetricTotal {
    event_type: EstablishmentEventType
    event_count: number
    unique_sessions: number
  }

  export interface MetricDay {
    date: string
    impressions: number
    views: number
    conversions: number
    unique_sessions: number
  }

  export interface EstablishmentSummary {
    establishment_id: number
    public_name: string
    slug: string
    impressions: number
    views: number
    conversions: number
    unique_sessions: number
  }

  export interface OrganizationDashboard {
    organization_id: number
    from: string
    to: string
    totals: MetricTotal[]
    timeseries: MetricDay[]
    establishments: EstablishmentSummary[]
  }

  export interface SearchTermSummary {
    date: string
    city_id: number
    city_name: string
    term: string
    category_slug: string | null
    searches: number
    unique_sessions: number
  }

  export interface SearchTermsPage {
    meta: {
      total: number
      page: number
      per_page: number
      last_page: number
    }
    data: SearchTermSummary[]
  }

  export interface RetentionResult {
    raw_events_deleted: number
    metric_sessions_deleted: number
    metrics_deleted: number
    search_sessions_deleted: number
    search_terms_deleted: number
  }
}

export default IAnalytics
