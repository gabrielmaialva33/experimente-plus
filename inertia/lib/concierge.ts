/**
 * The consumer side of the Concierge contract — ADR-0029.
 *
 * Every field is optional because the payload comes from a route that may be
 * older than this bundle during a rollout, and a reply that is missing a field
 * must render as less, never as a broken screen.
 */
export interface ConciergeItem {
  /** `<kind>:<id>`, a citation token. Never parsed, never used as an address. */
  ref?: string
  kind?: 'establishment' | 'experience' | 'event'
  name?: string
  city_slug?: string
  establishment_slug?: string
  establishment_name?: string
  district?: string | null
  category?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

export interface ConciergeReply {
  outcome: 'grounded' | 'degraded' | 'refused'
  text: string | null
  items: ConciergeItem[]
  model: string | null
}

/** The `filters` of a question, as `ConciergeFilters` in the OpenAPI. */
export interface ConciergeFilters {
  open_now?: boolean
  kind?: Array<'food' | 'leisure' | 'services'>
  min_rating?: number
  price?: Array<'up_to_50' | '50_100' | 'over_100'>
}

/**
 * The shortcuts shown above the question. Each one is a checkbox that narrows
 * the catalogue the answer may draw on; the server applies them before the
 * model sees anything, so the page only says which were ticked.
 */
export const CONCIERGE_SHORTCUTS = [
  { id: 'open_now', label: 'Aberto agora' },
  { id: 'food', label: 'Comida' },
  { id: 'leisure', label: 'Lazer' },
  { id: 'services', label: 'Serviços' },
  { id: 'well_rated', label: 'Bem avaliados (4+)' },
  { id: 'up_to_50', label: 'Até R$ 50' },
  { id: '50_100', label: 'R$ 50 a 100' },
  { id: 'over_100', label: 'Acima de R$ 100' },
] as const

export type ConciergeShortcut = (typeof CONCIERGE_SHORTCUTS)[number]['id']

/** "Bem avaliados" is a public review average of at least four. */
const WELL_RATED = 4

/**
 * The ticked shortcuts as the request's `filters`, or nothing when none is
 * ticked, so a question without shortcuts is sent exactly as before. Within
 * kinds and within prices any ticked value matches; across them, all hold.
 */
export function conciergeFiltersOf(
  selected: ReadonlySet<ConciergeShortcut>
): ConciergeFilters | null {
  const kind = (['food', 'leisure', 'services'] as const).filter((id) => selected.has(id))
  const price = (['up_to_50', '50_100', 'over_100'] as const).filter((id) => selected.has(id))
  const filters: ConciergeFilters = {
    ...(selected.has('open_now') ? { open_now: true } : {}),
    ...(kind.length > 0 ? { kind } : {}),
    ...(selected.has('well_rated') ? { min_rating: WELL_RATED } : {}),
    ...(price.length > 0 ? { price } : {}),
  }

  return Object.keys(filters).length > 0 ? filters : null
}

/**
 * The public address of the establishment behind an item, or nothing.
 *
 * Built from `city_slug` and `establishment_slug` because that pair is the
 * canonical public identity of an establishment (ADR-0016 §6) and the only one
 * that resolves from a URL. When either is missing the item is rendered as
 * text: a guessed link is an invented reference, which is the failure this
 * whole module exists to prevent.
 */
export function establishmentPathOf(item: ConciergeItem): string | null {
  const city = item.city_slug?.trim()
  const slug = item.establishment_slug?.trim()
  if (!city || !slug) return null

  return `/cidades/${encodeURIComponent(city)}/estabelecimentos/${encodeURIComponent(slug)}`
}

export async function askCatalogConcierge(
  question: string,
  city: string,
  signal?: AbortSignal,
  filters?: ConciergeFilters | null
): Promise<ConciergeReply> {
  const response = await fetch('/api/v1/catalog/concierge', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(filters ? { question, city, filters } : { question, city }),
  })

  if (!response.ok) {
    throw new Error(`Concierge request failed with status ${response.status}`)
  }

  return (await response.json()) as ConciergeReply
}
