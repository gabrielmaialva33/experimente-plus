/**
 * How the Explorer's own lists project an establishment — ADR-0030.
 *
 * The card is read from the discoverable projection and never from the
 * establishment row, so a unit that was suspended, withdrawn, or whose city was
 * deactivated simply does not produce a card. That is the same revalidation the
 * catalogue, partner content and the Concierge perform, and it is why saving
 * something cannot become a way back into what a withdrawal closed.
 */
export const ESTABLISHMENT_CARD_COLUMNS = `
  projection.establishment_id AS card_id,
  projection.establishment_slug AS card_slug,
  projection.public_name AS card_name,
  projection.city_slug AS card_city_slug,
  projection.city_name AS card_city_name,
  projection.cover_media->'asset'->>'url' AS card_cover_url,
  projection.categories->0->>'name' AS card_category
`

export interface CardColumns {
  card_id: number | string
  card_slug: string
  card_name: string
  card_city_slug: string
  card_city_name: string
  card_cover_url: string | null
  card_category: string | null
}

export function cardOf(row: CardColumns) {
  return {
    id: Number(row.card_id),
    slug: row.card_slug,
    name: row.card_name,
    city_slug: row.card_city_slug,
    city_name: row.card_city_name,
    cover_url: row.card_cover_url ?? null,
    category: row.card_category ?? null,
  }
}

export function instant(value: unknown): string {
  if (value === null || value === undefined) return new Date(0).toISOString()
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}
