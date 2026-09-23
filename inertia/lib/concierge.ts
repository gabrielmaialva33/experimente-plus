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
  signal?: AbortSignal
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
    body: JSON.stringify({ question, city }),
  })

  if (!response.ok) {
    throw new Error(`Concierge request failed with status ${response.status}`)
  }

  return (await response.json()) as ConciergeReply
}
