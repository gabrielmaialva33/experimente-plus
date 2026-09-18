import type EstablishmentEvent from '#modules/partner_content/models/establishment_event'
import type EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import type EstablishmentShowcaseItem from '#modules/partner_content/models/establishment_showcase_item'

/**
 * Partner-owned content — ADR-0028.
 *
 * The three kinds share one lifecycle on purpose: they differ in what they say,
 * not in how they are published, moderated or withdrawn. Writing three state
 * machines would have meant three places for the same rule to drift.
 */
namespace IPartnerContent {
  export const CANONICAL_CONTENT_KINDS = ['experience', 'event', 'showcase_item'] as const
  export type ContentKind = (typeof CANONICAL_CONTENT_KINDS)[number]

  /**
   * How the kind is spelled in a URL. Kept apart from the canonical value on
   * purpose: the route reads as a collection next to `/reviews`, while the
   * domain keeps the singular name the tables and the ADR use.
   */
  export const CANONICAL_CONTENT_PATHS = ['experiences', 'events', 'showcase-items'] as const
  export type ContentPath = (typeof CANONICAL_CONTENT_PATHS)[number]

  const KIND_BY_PATH: Record<ContentPath, ContentKind> = {
    'experiences': 'experience',
    'events': 'event',
    'showcase-items': 'showcase_item',
  }

  export const kindOfPath = (path: ContentPath): ContentKind => KIND_BY_PATH[path]

  export const CANONICAL_CONTENT_STATUSES = [
    'draft',
    'pending_review',
    'published',
    'archived',
  ] as const
  export type ContentStatus = (typeof CANONICAL_CONTENT_STATUSES)[number]

  export type ContentRow = EstablishmentExperience | EstablishmentEvent | EstablishmentShowcaseItem

  export interface CreatePayload {
    establishment_id: number
    title: string
    description?: string | null
    /** Events only. Resolved in the city's timezone, never the server's. */
    starts_at?: string
    ends_at?: string
    /** Showcase items only. Displayed, never charged. */
    informational_price_cents?: number | null
  }

  export interface UpdatePayload {
    title?: string
    description?: string | null
    starts_at?: string
    ends_at?: string
    informational_price_cents?: number | null
  }

  export interface ListQuery {
    page?: number
    per_page?: number
    status?: ContentStatus
    establishment_id?: number
  }

  export interface PolicyPayload {
    require_experience_approval?: boolean
    require_event_approval?: boolean
    require_showcase_item_approval?: boolean
    max_media_per_content?: number
    min_event_notice_minutes?: number
  }
}

export default IPartnerContent
