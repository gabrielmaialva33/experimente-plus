import type IMedia from '#modules/media/interfaces/media_interface'
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

  export interface MediaCreatePayload {
    alt_text: string
    caption?: string | null
    is_cover?: boolean
  }

  export interface MediaUpdatePayload {
    alt_text?: string
    caption?: string | null
  }

  export interface MediaAdministrativeProjection {
    id: number
    establishment_id: number
    content_id: number
    is_cover: boolean
    sort_order: number
    alt_text: string
    caption: string | null
    moderation_status: IMedia.ModerationStatus
    review_notes: string | null
    reviewed_at: string | null
    created_at: string
    updated_at: string
    asset: IMedia.AssetProjection
  }

  /**
   * The projections below are written as `type`, not `interface`, and that is
   * load-bearing rather than a matter of taste.
   *
   * They travel as Inertia page props, and `inertia.render` types its props
   * against `Record<string, JSONDataTypes>`. TypeScript grants an implicit
   * index signature to an object type alias and never to a named interface, so
   * declaring these as interfaces makes the whole page fail that constraint —
   * and because the signature is conditional, the failure surfaces as "not
   * assignable to parameter of type 'never'", which names neither the page nor
   * the offending field. Every other type the registry imports is an alias for
   * the same reason.
   *
   * The alias keeps the guarantee intact: a `DateTime` or a model instance
   * smuggled in here still fails to compile.
   */
  export type MediaPublicProjection = {
    id: number
    is_cover: boolean
    sort_order: number
    alt_text: string
    caption: string | null
    asset: Pick<
      IMedia.AssetProjection,
      'id' | 'media_type' | 'file_extension' | 'mime_type' | 'width' | 'height' | 'url'
    >
  }

  /**
   * What a visitor is allowed to read — derived on the server, never a
   * serialization of the row.
   *
   * `content.serialize()` used to be the public payload, and that leaked the
   * live columns (a title awaiting moderation), the lifecycle (`status`) and the
   * operation's own identifiers (`tenant_id`, `created_by`, `archived_by`) into
   * a response cached as `public, max-age=300` and into the SSR HTML. The
   * publication rule then had to be re-implemented by every client — web, and
   * the app of ADR-0022/0023 — which is exactly the drift ADR-0016 §6 forbids.
   *
   * So the fields below come from `published_snapshot` alone, and nothing that
   * is not listed here reaches a public surface.
   */
  export type PublicProjection = {
    id: number
    kind: ContentKind
    title: string
    description: string | null
    /** Events only. The instant of the approved snapshot, in UTC. */
    starts_at: string | null
    ends_at: string | null
    /** Showcase items only. Displayed, never charged. */
    informational_price_cents: number | null
    published_at: string
    media: MediaPublicProjection[]
  }

  /**
   * The one image a discovery band shows. Narrower than
   * `MediaPublicProjection` on purpose: a band renders a cover, not a gallery,
   * and `alt_text` travels with it because it is approved content, not
   * decoration.
   */
  export type DiscoveryCover = {
    url: string
    alt_text: string
    width: number | null
    height: number | null
  }

  /**
   * How a discovery item points back at its establishment.
   *
   * Slug plus city slug, never `establishment_id`: the public link is
   * `/cidades/{city_slug}/estabelecimentos/{slug}`, and keying a discovery
   * surface by the numeric identity would make it unresolvable from the URL and
   * would expose an internal identifier for no gain.
   */
  export type DiscoveryEstablishment = {
    slug: string
    name: string
  }

  export type CityAgendaEventItem = {
    id: number
    kind: 'event'
    title: string
    description: string | null
    starts_at: string
    ends_at: string
    cover: DiscoveryCover | null
    establishment: DiscoveryEstablishment
    city_slug: string
  }

  export type CityAgendaExperienceItem = {
    id: number
    kind: 'experience'
    title: string
    description: string | null
    published_at: string
    cover: DiscoveryCover | null
    establishment: DiscoveryEstablishment
    city_slug: string
  }

  /**
   * The agenda of one city.
   *
   * Three chronological lists, no ranking, no score and no sponsorship: there
   * is no prominence contract in this product, so `new_experiences` is labelled
   * as recency ("Novidades") and never as a highlight. `local_date` travels in
   * the payload because the whole window was computed in the city's timezone
   * and the client must not recompute it.
   */
  export type CityAgendaResponse = {
    city: {
      slug: string
      name: string
      state_code: string
      timezone: string
    }
    local_date: string
    happening_today: CityAgendaEventItem[]
    upcoming: CityAgendaEventItem[]
    new_experiences: CityAgendaExperienceItem[]
  }

  /**
   * The acts the history of a content item records — ADR-0028 §4.
   *
   * `admin_edited` is its own act rather than an `updated` with a different
   * actor: an administrator's edit has different consequences (it can change
   * what the public reads at once), and the history has to say which it was.
   */
  export const CANONICAL_EVENT_ACTIONS = [
    'created',
    'updated',
    'submitted',
    'approved',
    'rejected',
    'archived',
    'admin_edited',
  ] as const
  export type EventAction = (typeof CANONICAL_EVENT_ACTIONS)[number]

  /** Only the fields that moved. Never identifiers, never the whole row. */
  export type FieldChanges = Record<string, { from: unknown; to: unknown }>

  export type EventProjection = {
    id: number
    action: EventAction
    from_status: ContentStatus | null
    to_status: ContentStatus | null
    actor: { id: number; full_name: string } | null
    changes: FieldChanges | null
    metadata: Record<string, unknown> | null
    created_at: string
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
