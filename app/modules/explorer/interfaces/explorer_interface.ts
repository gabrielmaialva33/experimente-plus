/**
 * The Explorer's own layer — ADR-0030, Anexo I item 10.
 *
 * Everything here belongs to one person in one operation. Nothing in this
 * namespace is ever served publicly, and no shape describes another user.
 */
namespace IExplorer {
  /**
   * How an establishment is shown inside the Explorer's own lists.
   *
   * Narrower than the catalogue detail on purpose: a saved list renders cards
   * and navigates, it does not reproduce the establishment page. The link is
   * built from `city_slug` and `slug` (ADR-0016 §6), never from the numeric
   * identity.
   */
  export interface EstablishmentCard {
    id: number
    slug: string
    name: string
    city_slug: string
    city_name: string
    cover_url: string | null
    category: string | null
  }

  export interface SavedEstablishment {
    id: number
    establishment: EstablishmentCard
    created_at: string
  }

  /**
   * A saved list as the Explorer reads it.
   *
   * `unavailable` is the count of rows kept in the database whose target is not
   * discoverable right now — suspended, withdrawn, in a deactivated city. They
   * are not returned as navigable items, because that would reopen through a
   * side door what the withdrawal closed; the count exists so the app can say
   * so instead of letting the person believe their saves disappeared.
   */
  export interface SavedList {
    data: SavedEstablishment[]
    unavailable: number
  }

  /**
   * The category is identified by its slug, as the public catalogue identifies
   * it. The catalogue never publishes a category's numeric id, so an interest
   * addressed by id could not be chosen from the list the app actually shows.
   */
  export interface InterestProjection {
    id: number
    category: {
      slug: string
      name: string
      is_active: boolean
    }
    created_at: string
  }

  /**
   * One stop of an itinerary.
   *
   * `establishment` is null when the stop points at something that left the
   * catalogue. The stop itself is kept: silently dropping it would rewrite a
   * route the person wrote, which is worse than showing a gap they can decide
   * about.
   */
  export interface ItineraryStop {
    id: number
    position: number
    note: string | null
    establishment: EstablishmentCard | null
  }

  export interface ItineraryProjection {
    id: number
    name: string
    notes: string | null
    stops: ItineraryStop[]
    created_at: string
    updated_at: string
  }

  export interface ItinerarySummary {
    id: number
    name: string
    notes: string | null
    stops_count: number
    created_at: string
    updated_at: string
  }

  export interface ItineraryPayload {
    name: string
    notes?: string | null
  }

  export interface StopPayload {
    establishment_id: number
    note?: string | null
    position?: number
  }

  export interface ReorderPayload {
    stop_ids: number[]
  }
}

export default IExplorer
