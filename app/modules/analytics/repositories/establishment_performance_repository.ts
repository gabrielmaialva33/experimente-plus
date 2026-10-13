import db from '@adonisjs/lucid/services/db'

import type {
  PerformanceClickChannel,
  PerformanceComparison,
} from '#modules/analytics/interfaces/establishment_performance_page'
import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'
import type { InstantBounds, LocalDateRange } from '#modules/analytics/utils/performance_period'

/** The category attribute whose value is the place's "Ticket médio". */
export const AVERAGE_TICKET_ATTRIBUTE_KEY = 'average_ticket'

export interface PerformanceEstablishment {
  id: number
  organization_id: number
  organization_name: string
  published_revision_id: number | null
  latest_revision_id: number | null
  latest_revision_status: string | null
  public_name: string | null
  city_timezone: string | null
  primary_category_id: number | null
}

export interface PerformanceEdition {
  name: string
  usage_starts_at: Date
  usage_ends_at: Date
}

export interface PerformanceTrendDay {
  date: string
  impressions: number
  views: number
  clicks: number
}

export interface PerformanceReviewSummary {
  count: PerformanceComparison
  average: { current: number | null; previous: number | null }
}

export interface PerformanceWindowBounds {
  current: InstantBounds
  previous: InstantBounds
}

/** Click events and the contact each one leads to. */
export const PERFORMANCE_CLICK_EVENTS: Record<
  PerformanceClickChannel,
  IAnalytics.EstablishmentEventType
> = {
  route: 'route_click',
  whatsapp: 'whatsapp_click',
  phone: 'phone_click',
  website: 'website_click',
}

const CLICK_EVENT_LIST = Object.values(PERFORMANCE_CLICK_EVENTS)
  .map((type) => `'${type}'`)
  .join(', ')

type CreatedRelation = 'explorer_follows' | 'explorer_favorites'

interface WindowCountRow {
  current_count: string | number | null
  previous_count: string | number | null
}

const toNumber = (value: string | number | null | undefined) => Number(value ?? 0)

/**
 * Aggregates of one place for the partner's "Desempenho" page.
 *
 * Every query is bounded by tenant, establishment and the two windows, so each
 * reads the establishment/date indexes of its table. Discovery numbers come
 * from the daily aggregates of ADR-0017, never from raw events; the rest are
 * counts over tables the place already owns. Nothing here returns a person.
 */
export default class EstablishmentPerformanceRepository {
  /**
   * The place, its organization (unless archived) and the city whose calendar
   * the daily aggregates use. The name follows the Portal: the newest version
   * first, the published one otherwise.
   */
  async findEstablishment(
    tenantId: number,
    establishmentId: number
  ): Promise<PerformanceEstablishment | null> {
    const result = await db.rawQuery<{ rows: PerformanceEstablishment[] }>(
      `
        SELECT
          establishments.id,
          establishments.organization_id,
          organizations.trade_name AS organization_name,
          establishments.published_revision_id,
          latest.id AS latest_revision_id,
          latest.status AS latest_revision_status,
          COALESCE(
            NULLIF(BTRIM(latest.public_name), ''),
            NULLIF(BTRIM(published.public_name), '')
          ) AS public_name,
          cities.timezone AS city_timezone,
          primary_category.category_id AS primary_category_id
        FROM establishments
        INNER JOIN organizations
          ON organizations.id = establishments.organization_id
         AND organizations.tenant_id = establishments.tenant_id
        LEFT JOIN establishment_revisions AS published
          ON published.id = establishments.published_revision_id
         AND published.tenant_id = establishments.tenant_id
        LEFT JOIN LATERAL (
          SELECT revisions.id, revisions.status, revisions.public_name, revisions.city_id
          FROM establishment_revisions AS revisions
          WHERE revisions.tenant_id = establishments.tenant_id
            AND revisions.establishment_id = establishments.id
          ORDER BY revisions.version DESC
          LIMIT 1
        ) AS latest ON TRUE
        LEFT JOIN cities
          ON cities.tenant_id = establishments.tenant_id
         AND cities.id = COALESCE(published.city_id, latest.city_id)
        LEFT JOIN LATERAL (
          SELECT categories.category_id
          FROM establishment_revision_categories AS categories
          WHERE categories.tenant_id = establishments.tenant_id
            AND categories.revision_id = latest.id
            AND categories.is_primary = TRUE
          ORDER BY categories.sort_order ASC, categories.id ASC
          LIMIT 1
        ) AS primary_category ON TRUE
        WHERE establishments.tenant_id = ?
          AND establishments.id = ?
          AND organizations.status <> 'archived'
      `,
      [tenantId, establishmentId]
    )

    const row = result.rows[0]
    if (!row) return null

    return {
      ...row,
      id: Number(row.id),
      organization_id: Number(row.organization_id),
      published_revision_id: row.published_revision_id ? Number(row.published_revision_id) : null,
      latest_revision_id: row.latest_revision_id ? Number(row.latest_revision_id) : null,
      primary_category_id: row.primary_category_id ? Number(row.primary_category_id) : null,
    }
  }

  /**
   * The edition the place takes part in whose usage window holds `at`. A
   * draft offer is not taking part yet; the most recently started edition wins
   * when two overlap.
   */
  async currentEdition(
    tenantId: number,
    establishmentId: number,
    at: Date
  ): Promise<PerformanceEdition | null> {
    const row = await db
      .from('benefit_editions as editions')
      .where('editions.tenant_id', tenantId)
      .whereIn('editions.status', ['published', 'paused'])
      .where('editions.usage_starts_at', '<=', at)
      .where('editions.usage_ends_at', '>=', at)
      .whereExists((offers) => {
        offers
          .from('benefit_offers as offers')
          .whereColumn('offers.tenant_id', 'editions.tenant_id')
          .whereColumn('offers.edition_id', 'editions.id')
          .where('offers.establishment_id', establishmentId)
          .whereNot('offers.status', 'draft')
      })
      .orderBy('editions.usage_starts_at', 'desc')
      .orderBy('editions.id', 'desc')
      .select('editions.name', 'editions.usage_starts_at', 'editions.usage_ends_at')
      .first()

    return row
      ? {
          name: String(row.name),
          usage_starts_at: new Date(row.usage_starts_at),
          usage_ends_at: new Date(row.usage_ends_at),
        }
      : null
  }

  /** Each discovery event of the place, summed over both windows of local days. */
  async eventTotals(
    tenantId: number,
    establishmentId: number,
    current: LocalDateRange,
    previous: LocalDateRange
  ): Promise<Map<string, PerformanceComparison>> {
    const result = await db.rawQuery<{
      rows: Array<WindowCountRow & { event_type: string }>
    }>(
      `
        SELECT
          metrics.event_type,
          SUM(metrics.event_count) FILTER (
            WHERE metrics.metric_date BETWEEN ?::date AND ?::date
          )::bigint AS current_count,
          SUM(metrics.event_count) FILTER (
            WHERE metrics.metric_date BETWEEN ?::date AND ?::date
          )::bigint AS previous_count
        FROM analytics_daily_metrics AS metrics
        WHERE metrics.tenant_id = ?
          AND metrics.establishment_id = ?
          AND metrics.metric_date BETWEEN ?::date AND ?::date
        GROUP BY metrics.event_type
      `,
      [
        current.from,
        current.to,
        previous.from,
        previous.to,
        tenantId,
        establishmentId,
        previous.from,
        current.to,
      ]
    )

    return new Map(
      result.rows.map((row) => [
        row.event_type,
        { current: toNumber(row.current_count), previous: toNumber(row.previous_count) },
      ])
    )
  }

  /** One row per local day of the range, days without events included as zeros. */
  async dailyTrend(
    tenantId: number,
    establishmentId: number,
    range: LocalDateRange
  ): Promise<PerformanceTrendDay[]> {
    const result = await db.rawQuery<{
      rows: Array<{
        date: string
        impressions: string | number
        views: string | number
        clicks: string | number
      }>
    }>(
      `
        SELECT
          days.day::date::text AS date,
          COALESCE(SUM(metrics.event_count) FILTER (
            WHERE metrics.event_type = 'catalog_impression'
          ), 0)::bigint AS impressions,
          COALESCE(SUM(metrics.event_count) FILTER (
            WHERE metrics.event_type = 'establishment_view'
          ), 0)::bigint AS views,
          COALESCE(SUM(metrics.event_count) FILTER (
            WHERE metrics.event_type IN (${CLICK_EVENT_LIST})
          ), 0)::bigint AS clicks
        FROM generate_series(?::date, ?::date, interval '1 day') AS days(day)
        LEFT JOIN analytics_daily_metrics AS metrics
          ON metrics.tenant_id = ?
         AND metrics.establishment_id = ?
         AND metrics.metric_date = days.day::date
        GROUP BY days.day
        ORDER BY days.day ASC
      `,
      [range.from, range.to, tenantId, establishmentId]
    )

    return result.rows.map((row) => ({
      date: row.date,
      impressions: toNumber(row.impressions),
      views: toNumber(row.views),
      clicks: toNumber(row.clicks),
    }))
  }

  /**
   * People who started following the place in each window and still follow
   * it. Leaving removes the row, so a follow undone is not counted.
   */
  async newFollowers(
    tenantId: number,
    establishmentId: number,
    bounds: PerformanceWindowBounds
  ): Promise<PerformanceComparison> {
    return this.countCreated('explorer_follows', tenantId, establishmentId, bounds)
  }

  /** Favourites saved in each window that are still saved. */
  async newFavorites(
    tenantId: number,
    establishmentId: number,
    bounds: PerformanceWindowBounds
  ): Promise<PerformanceComparison> {
    return this.countCreated('explorer_favorites', tenantId, establishmentId, bounds)
  }

  /** Benefits used at the place: one confirmed redemption is one use. */
  async redemptions(
    tenantId: number,
    establishmentId: number,
    bounds: PerformanceWindowBounds
  ): Promise<PerformanceComparison> {
    const result = await db.rawQuery<{ rows: WindowCountRow[] }>(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE redemptions.redeemed_at >= ?::timestamptz
              AND redemptions.redeemed_at < ?::timestamptz
          )::bigint AS current_count,
          COUNT(*) FILTER (
            WHERE redemptions.redeemed_at >= ?::timestamptz
              AND redemptions.redeemed_at < ?::timestamptz
          )::bigint AS previous_count
        FROM benefit_redemptions AS redemptions
        WHERE redemptions.tenant_id = ?
          AND redemptions.establishment_id = ?
          AND redemptions.redeemed_at >= ?::timestamptz
          AND redemptions.redeemed_at < ?::timestamptz
      `,
      [...this.windowBindings(bounds), tenantId, establishmentId, ...this.spanBindings(bounds)]
    )

    return this.comparison(result.rows[0])
  }

  /**
   * Reviews received in each window and their average rating, under the rule
   * the public listing reads: published, and the author is not banned.
   */
  async reviews(
    tenantId: number,
    establishmentId: number,
    bounds: PerformanceWindowBounds
  ): Promise<PerformanceReviewSummary> {
    const result = await db.rawQuery<{
      rows: Array<
        WindowCountRow & {
          current_average: string | number | null
          previous_average: string | number | null
        }
      >
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE reviews.created_at >= ?::timestamptz AND reviews.created_at < ?::timestamptz)::bigint AS current_count,
          ROUND(AVG(reviews.rating) FILTER (WHERE reviews.created_at >= ?::timestamptz AND reviews.created_at < ?::timestamptz)::numeric, 1)::float AS current_average,
          COUNT(*) FILTER (WHERE reviews.created_at >= ?::timestamptz AND reviews.created_at < ?::timestamptz)::bigint AS previous_count,
          ROUND(AVG(reviews.rating) FILTER (WHERE reviews.created_at >= ?::timestamptz AND reviews.created_at < ?::timestamptz)::numeric, 1)::float AS previous_average
        FROM establishment_reviews AS reviews
        WHERE reviews.tenant_id = ?
          AND reviews.establishment_id = ?
          AND reviews.status = 'published'
          AND reviews.created_at >= ?::timestamptz
          AND reviews.created_at < ?::timestamptz
          AND NOT EXISTS (
            SELECT 1
            FROM user_tenants AS memberships
            WHERE memberships.user_id = reviews.user_id
              AND memberships.tenant_id = reviews.tenant_id
              AND memberships.banned_at IS NOT NULL
          )
      `,
      [
        bounds.current.start,
        bounds.current.end,
        bounds.current.start,
        bounds.current.end,
        bounds.previous.start,
        bounds.previous.end,
        bounds.previous.start,
        bounds.previous.end,
        tenantId,
        establishmentId,
        ...this.spanBindings(bounds),
      ]
    )

    const row = result.rows[0]
    const average = (value: string | number | null | undefined) =>
      value === null || value === undefined ? null : Number(value)

    return {
      count: this.comparison(row),
      average: { current: average(row?.current_average), previous: average(row?.previous_average) },
    }
  }

  /**
   * The "Ticket médio" of each revision that has one, in reais. A value of
   * zero is no value. Only an active field counts: an inactive one is neither
   * shown to the public nor editable by the partner.
   */
  async averageTickets(tenantId: number, revisionIds: number[]): Promise<Map<number, number>> {
    const ids = [...new Set(revisionIds)]
    if (ids.length === 0) return new Map()

    const rows = await db
      .from('establishment_revision_attribute_values as attribute_values')
      .innerJoin('category_attribute_definitions as definitions', (join) => {
        join
          .on('definitions.id', 'attribute_values.attribute_definition_id')
          .andOn('definitions.tenant_id', 'attribute_values.tenant_id')
      })
      .where('attribute_values.tenant_id', tenantId)
      .whereIn('attribute_values.revision_id', ids)
      .where('definitions.key', AVERAGE_TICKET_ATTRIBUTE_KEY)
      .where('definitions.is_active', true)
      .orderBy('definitions.id', 'asc')
      .select(
        'attribute_values.revision_id',
        db.raw(
          'COALESCE(attribute_values.value_decimal, attribute_values.value_integer::numeric)::text AS value'
        )
      )

    const tickets = new Map<number, number>()
    for (const row of rows as Array<{ revision_id: number; value: string | null }>) {
      const value = row.value === null ? Number.NaN : Number(row.value)
      const revisionId = Number(row.revision_id)
      if (Number.isFinite(value) && value > 0 && !tickets.has(revisionId)) {
        tickets.set(revisionId, value)
      }
    }
    return tickets
  }

  /** The contacts the published page offers, which decide the outbound clicks there. */
  async publishedContacts(
    tenantId: number,
    establishmentId: number
  ): Promise<Record<PerformanceClickChannel, boolean>> {
    const row = await db
      .from('catalog_establishments')
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .select('public_phone', 'whatsapp', 'website', 'latitude', 'longitude')
      .first()

    const present = (value: unknown) => typeof value === 'string' && value.trim().length > 0

    return {
      route: Boolean(row) && row.latitude !== null && row.longitude !== null,
      whatsapp: present(row?.whatsapp),
      phone: present(row?.public_phone),
      website: present(row?.website),
    }
  }

  private async countCreated(
    table: CreatedRelation,
    tenantId: number,
    establishmentId: number,
    bounds: PerformanceWindowBounds
  ): Promise<PerformanceComparison> {
    const result = await db.rawQuery<{ rows: WindowCountRow[] }>(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE relation.created_at >= ?::timestamptz
              AND relation.created_at < ?::timestamptz
          )::bigint AS current_count,
          COUNT(*) FILTER (
            WHERE relation.created_at >= ?::timestamptz
              AND relation.created_at < ?::timestamptz
          )::bigint AS previous_count
        FROM ${table} AS relation
        WHERE relation.tenant_id = ?
          AND relation.establishment_id = ?
          AND relation.created_at >= ?::timestamptz
          AND relation.created_at < ?::timestamptz
      `,
      [...this.windowBindings(bounds), tenantId, establishmentId, ...this.spanBindings(bounds)]
    )

    return this.comparison(result.rows[0])
  }

  private windowBindings(bounds: PerformanceWindowBounds): string[] {
    return [bounds.current.start, bounds.current.end, bounds.previous.start, bounds.previous.end]
  }

  /** Both windows at once: the comparison always ends where the current one starts or before. */
  private spanBindings(bounds: PerformanceWindowBounds): string[] {
    return [bounds.previous.start, bounds.current.end]
  }

  private comparison(row: WindowCountRow | undefined): PerformanceComparison {
    return { current: toNumber(row?.current_count), previous: toNumber(row?.previous_count) }
  }
}
