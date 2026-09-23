import db from '@adonisjs/lucid/services/db'

import { discoverableEstablishmentsForTenantSql } from '#modules/catalog/repositories/catalog_discoverability'
import IConcierge from '#modules/concierge/interfaces/concierge_interface'

/**
 * The only source of fact the Concierge is allowed — ADR-0029.
 *
 * It reads the published catalogue and nothing else: what is not discoverable
 * was withheld on purpose, and the model must never see it. Discoverability is
 * not read off `is_discoverable` alone, because that column lives in a
 * reconstructible projection which can outlive the states behind it; the single
 * revalidation of ADR-0016 §3 is imported instead, so this module cannot drift
 * away from the catalogue it claims to quote.
 *
 * The withheld names are returned alongside so the answer can be checked for
 * mentioning a place the request deliberately excluded, which a consumer could
 * not tell apart from an invented one.
 */

/** The two content species and the tables they live in. */
const CONTENT_TABLES = {
  experience: 'establishment_experiences',
  event: 'establishment_events',
} as const

type ContentKind = keyof typeof CONTENT_TABLES

/** How many withheld names are worth carrying into the prose check. */
const WITHHELD_LIMIT = 200

export interface GroundingQuery {
  sql: string
  bindings: (string | number | Date)[]
}

/**
 * How the single prompt budget is divided between the three species.
 *
 * There is one ceiling (`CONCIERGE_MAX_CATALOG_ITEMS`) because what costs money
 * and latency is the size of the prompt, not the number of tables behind it. The
 * division is a pure function of that ceiling, so the composition of a prompt can
 * be reasoned about before any query runs: a quarter of the budget is reserved
 * for events, a quarter for experiences, and the remainder — never less than
 * half — goes to establishments, which are the backbone of discovery and the
 * only species that answers a question about a place.
 *
 * Reserved content slots that nothing published fills are handed back to
 * establishments by `forQuestion`, so a catalogue without partner content still
 * offers a full prompt instead of half of one.
 */
export function splitGroundingBudget(limit: number): {
  event: number
  experience: number
  establishment: number
  total: number
} {
  const total = Math.max(0, Math.trunc(limit))
  const event = Math.floor(total / 4)
  const experience = Math.floor(total / 4)

  return { event, experience, establishment: total - event - experience, total }
}

/**
 * Discoverable establishments of one operation, narrowed by city when the
 * question named one.
 *
 * City is a discovery state and never an operation selector (ADR-0008), so it
 * narrows the tenant-scoped set instead of replacing the tenant binding.
 */
export function establishmentGroundingQuery(params: {
  tenantId: number
  citySlug: string | null
  limit: number
}): GroundingQuery {
  const { tenantId, citySlug, limit } = params

  return {
    sql: `
      WITH discoverable AS (
        ${discoverableEstablishmentsForTenantSql}
      )
      SELECT
        place.establishment_id,
        place.public_name,
        place.establishment_slug,
        place.city_slug,
        place.address,
        place.categories
      FROM discoverable place
      ${citySlug ? 'WHERE place.city_slug = ?' : ''}
      ORDER BY place.public_name ASC, place.establishment_slug ASC, place.establishment_id ASC
      LIMIT ?
    `,
    bindings: citySlug ? [tenantId, citySlug, limit] : [tenantId, limit],
  }
}

/**
 * Published experiences or events of discoverable establishments.
 *
 * Every field the model will read comes from `published_snapshot`, never from
 * the live columns: when a published item is edited and the operation requires
 * approval, the row moves to `pending_review` while the approved version stays
 * on air (ADR-0028 §4). Filtering by `status = 'published'` would take a real
 * event off the air because someone fixed a comma, and reading `content.title`
 * would hand the model a title no moderator has approved. Hence "has an approved
 * version and was not withdrawn", with the event window read from that same
 * snapshot.
 */
export function contentGroundingQuery(params: {
  kind: ContentKind
  tenantId: number
  citySlug: string | null
  limit: number
  now: Date
}): GroundingQuery {
  const { kind, tenantId, citySlug, limit, now } = params
  const isEvent = kind === 'event'

  const window = isEvent
    ? `content.published_snapshot->>'starts_at' AS starts_at,
        content.published_snapshot->>'ends_at' AS ends_at,`
    : `NULL::text AS starts_at,
        NULL::text AS ends_at,`

  const order = isEvent
    ? `(content.published_snapshot->>'starts_at')::timestamptz ASC`
    : `content.published_snapshot->>'title' ASC`

  return {
    sql: `
      WITH discoverable AS (
        ${discoverableEstablishmentsForTenantSql}
      )
      SELECT
        content.id AS content_id,
        content.published_snapshot->>'title' AS title,
        ${window}
        place.establishment_id,
        place.public_name,
        place.establishment_slug,
        place.city_slug,
        place.address,
        place.categories
      FROM ${CONTENT_TABLES[kind]} content
      JOIN discoverable place
        ON place.establishment_id = content.establishment_id
       AND place.tenant_id = content.tenant_id
      WHERE content.tenant_id = ?
        AND content.published_snapshot IS NOT NULL
        AND content.status <> 'archived'
        AND coalesce(content.published_snapshot->>'title', '') <> ''
        ${isEvent ? `AND (content.published_snapshot->>'ends_at')::timestamptz > ?` : ''}
        ${citySlug ? 'AND place.city_slug = ?' : ''}
      ORDER BY ${order}, place.establishment_slug ASC, content.id ASC
      LIMIT ?
    `,
    bindings: [
      tenantId,
      tenantId,
      ...(isEvent ? [now] : []),
      ...(citySlug ? [citySlug] : []),
      limit,
    ],
  }
}

/**
 * Names of discoverable establishments this question did not offer.
 *
 * Only establishments, never content titles: the check these names feed removes
 * prose naming a place that was deliberately excluded, and a title is not a
 * place. `excludedEstablishmentIds` carries every establishment the prompt
 * already names — including the ones that reached it as the host of an offered
 * experience or event — because censoring a place the model was legitimately
 * shown would mangle a correct answer.
 */
export function withheldNamesQuery(params: {
  tenantId: number
  excludedEstablishmentIds: readonly number[]
  limit: number
}): GroundingQuery {
  const { tenantId, excludedEstablishmentIds, limit } = params
  const excluded = excludedEstablishmentIds.map((id) => Math.trunc(id))
  const placeholders = excluded.map(() => '?').join(', ')

  return {
    sql: `
      WITH discoverable AS (
        ${discoverableEstablishmentsForTenantSql}
      )
      SELECT place.public_name
      FROM discoverable place
      ${excluded.length > 0 ? `WHERE place.establishment_id NOT IN (${placeholders})` : ''}
      ORDER BY place.public_name ASC
      LIMIT ?
    `,
    bindings: [tenantId, ...excluded, limit],
  }
}

interface PlaceColumns {
  establishment_id: number | string
  public_name: string
  establishment_slug: string
  city_slug: string
  address: unknown
  categories: unknown
}

type ContentColumns = PlaceColumns & {
  content_id: number | string
  title: string
  starts_at: string | Date | null
  ends_at: string | Date | null
}

/**
 * An offered item and the establishment it belongs to. The host identity stays
 * on this side of the boundary: the item itself carries slugs, because a numeric
 * identifier has no use in a public payload and no client should be able to
 * address a place by it (ADR-0016 §6).
 */
interface OfferedRow {
  item: IConcierge.GroundingItem
  establishmentId: number
}

export default class CatalogGroundingRepository {
  /**
   * One query per species, each with its own ceiling — never one query per item.
   * The published content of an establishment is read in bulk here rather than
   * through the per-establishment reader of ADR-0028, which would turn a single
   * prompt into a query per place.
   */
  async forQuestion(
    tenantId: number,
    citySlug: string | null,
    limit: number,
    now: Date = new Date()
  ): Promise<{ offered: IConcierge.GroundingItem[]; withheld: string[] }> {
    const budget = splitGroundingBudget(limit)

    const events = await this.content('event', tenantId, citySlug, budget.event, now)
    const experiences = await this.content('experience', tenantId, citySlug, budget.experience, now)

    // Reserved content slots nobody used belong to establishments, so a
    // catalogue with no partner content still fills the prompt.
    const establishments = await this.establishments(
      tenantId,
      citySlug,
      budget.total - events.length - experiences.length
    )

    const rows = [...establishments, ...experiences, ...events]

    return {
      offered: rows.map((row) => row.item),
      withheld: await this.withheld(tenantId, rows),
    }
  }

  private async establishments(
    tenantId: number,
    citySlug: string | null,
    limit: number
  ): Promise<OfferedRow[]> {
    if (limit <= 0) return []

    const query = establishmentGroundingQuery({ tenantId, citySlug, limit })
    const result = await db.rawQuery<{ rows: PlaceColumns[] }>(query.sql, query.bindings)

    return result.rows.map((row) => {
      const establishmentId = Number(row.establishment_id)

      return {
        establishmentId,
        item: {
          ...this.place(row),
          ref: IConcierge.refOf('establishment', establishmentId),
          kind: 'establishment' as const,
          name: String(row.public_name),
          starts_at: null,
          ends_at: null,
        },
      }
    })
  }

  private async content(
    kind: ContentKind,
    tenantId: number,
    citySlug: string | null,
    limit: number,
    now: Date
  ): Promise<OfferedRow[]> {
    if (limit <= 0) return []

    const query = contentGroundingQuery({ kind, tenantId, citySlug, limit, now })
    const result = await db.rawQuery<{ rows: ContentColumns[] }>(query.sql, query.bindings)

    return result.rows.map((row) => ({
      establishmentId: Number(row.establishment_id),
      item: {
        ...this.place(row),
        ref: IConcierge.refOf(kind, Number(row.content_id)),
        kind,
        name: String(row.title),
        starts_at: this.instant(row.starts_at),
        ends_at: this.instant(row.ends_at),
      },
    }))
  }

  private async withheld(tenantId: number, rows: OfferedRow[]): Promise<string[]> {
    const query = withheldNamesQuery({
      tenantId,
      excludedEstablishmentIds: [...new Set(rows.map((row) => row.establishmentId))],
      limit: WITHHELD_LIMIT,
    })
    const result = await db.rawQuery<{ rows: { public_name: string }[] }>(query.sql, query.bindings)

    // Two establishments may publish under the same name. Censoring prose for a
    // name the model was legitimately shown would damage a correct answer, so a
    // name in sight is never treated as withheld.
    const inSight = new Set(rows.map((row) => row.item.establishment_name))

    return result.rows.map((row) => String(row.public_name)).filter((name) => !inSight.has(name))
  }

  /** The columns every species shares, because content is located by its place. */
  private place(
    row: PlaceColumns
  ): Pick<
    IConcierge.GroundingItem,
    'city_slug' | 'establishment_slug' | 'establishment_name' | 'district' | 'category'
  > {
    const address = (row.address ?? {}) as Record<string, unknown>
    const categories = Array.isArray(row.categories) ? row.categories : []
    const first = (categories[0] ?? {}) as Record<string, unknown>

    return {
      city_slug: String(row.city_slug ?? ''),
      establishment_slug: String(row.establishment_slug ?? ''),
      establishment_name: String(row.public_name),
      district: address.district ? String(address.district) : null,
      category: first.name ? String(first.name) : null,
    }
  }

  private instant(value: string | Date | null): string | null {
    if (!value) return null
    return value instanceof Date ? value.toISOString() : String(value)
  }
}
