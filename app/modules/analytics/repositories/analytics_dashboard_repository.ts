import db from '@adonisjs/lucid/services/db'

import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'

interface MetricRow {
  event_type: IAnalytics.EstablishmentEventType
  event_count: string | number
  unique_sessions: string | number
}

interface MetricDayRow {
  date: string
  impressions: string | number
  views: string | number
  conversions: string | number
  unique_sessions: string | number
}

interface EstablishmentRow {
  establishment_id: number
  public_name: string
  slug: string
  impressions: string | number
  views: string | number
  conversions: string | number
  unique_sessions: string | number
}

interface SearchTermRow {
  date: string
  city_id: number
  city_name: string
  search_term_redacted: string
  category_slug: string | null
  event_count: string | number
  unique_sessions: string | number
}

export default class AnalyticsDashboardRepository {
  async organizationExists(tenantId: number, organizationId: number): Promise<boolean> {
    const row = await db
      .from('organizations')
      .where('tenant_id', tenantId)
      .where('id', organizationId)
      .whereNot('status', 'archived')
      .first()

    return Boolean(row)
  }

  async cityExists(tenantId: number, cityId: number): Promise<boolean> {
    const row = await db.from('cities').where('tenant_id', tenantId).where('id', cityId).first()

    return Boolean(row)
  }

  async establishmentBelongsToOrganization(
    tenantId: number,
    organizationId: number,
    establishmentId: number
  ): Promise<boolean> {
    const row = await db
      .from('establishments')
      .where('tenant_id', tenantId)
      .where('organization_id', organizationId)
      .where('id', establishmentId)
      .first()

    return Boolean(row)
  }

  async organizationDashboard(
    tenantId: number,
    organizationId: number,
    range: { from: string; to: string; establishmentId?: number }
  ): Promise<{
    totals: IAnalytics.MetricTotal[]
    series: IAnalytics.MetricDay[]
    establishments: IAnalytics.EstablishmentSummary[]
  }> {
    const establishmentFilter = range.establishmentId ? 'AND metrics.establishment_id = ?' : ''
    const establishmentBindings = range.establishmentId ? [range.establishmentId] : []

    const totalsResult = await db.rawQuery<{ rows: MetricRow[] }>(
      `
        SELECT
          metrics.event_type,
          SUM(metrics.event_count)::bigint AS event_count,
          SUM(metrics.unique_sessions)::bigint AS unique_sessions
        FROM analytics_daily_metrics AS metrics
        INNER JOIN establishments AS establishments
          ON establishments.id = metrics.establishment_id
         AND establishments.tenant_id = metrics.tenant_id
        WHERE metrics.tenant_id = ?
          AND establishments.organization_id = ?
          AND metrics.metric_date BETWEEN ?::date AND ?::date
          ${establishmentFilter}
        GROUP BY metrics.event_type
        ORDER BY metrics.event_type ASC
      `,
      [tenantId, organizationId, range.from, range.to, ...establishmentBindings]
    )

    const seriesResult = await db.rawQuery<{ rows: MetricDayRow[] }>(
      `
        WITH metric_totals AS (
          SELECT
            metrics.metric_date,
            SUM(metrics.event_count) FILTER (
              WHERE metrics.event_type = 'catalog_impression'
            )::bigint AS impressions,
            SUM(metrics.event_count) FILTER (
              WHERE metrics.event_type = 'establishment_view'
            )::bigint AS views,
            SUM(metrics.event_count) FILTER (
              WHERE metrics.event_type IN (
                'route_click',
                'whatsapp_click',
                'phone_click',
                'website_click'
              )
            )::bigint AS conversions
          FROM analytics_daily_metrics AS metrics
          INNER JOIN establishments AS establishments
            ON establishments.id = metrics.establishment_id
           AND establishments.tenant_id = metrics.tenant_id
          WHERE metrics.tenant_id = ?
            AND establishments.organization_id = ?
            AND metrics.metric_date BETWEEN ?::date AND ?::date
            ${establishmentFilter}
          GROUP BY metrics.metric_date
        ),
        session_totals AS (
          SELECT
            sessions.metric_date,
            COUNT(DISTINCT sessions.anonymous_session_hash)::bigint AS unique_sessions
          FROM analytics_daily_metric_sessions AS sessions
          INNER JOIN establishments AS establishments
            ON establishments.id = sessions.establishment_id
           AND establishments.tenant_id = sessions.tenant_id
          WHERE sessions.tenant_id = ?
            AND establishments.organization_id = ?
            AND sessions.metric_date BETWEEN ?::date AND ?::date
            ${establishmentFilter.replaceAll('metrics.', 'sessions.')}
          GROUP BY sessions.metric_date
        )
        SELECT
          metric_totals.metric_date::text AS date,
          COALESCE(metric_totals.impressions, 0)::bigint AS impressions,
          COALESCE(metric_totals.views, 0)::bigint AS views,
          COALESCE(metric_totals.conversions, 0)::bigint AS conversions,
          COALESCE(session_totals.unique_sessions, 0)::bigint AS unique_sessions
        FROM metric_totals
        LEFT JOIN session_totals USING (metric_date)
        ORDER BY metric_totals.metric_date ASC
      `,
      [
        tenantId,
        organizationId,
        range.from,
        range.to,
        ...establishmentBindings,
        tenantId,
        organizationId,
        range.from,
        range.to,
        ...establishmentBindings,
      ]
    )

    const establishmentsResult = await db.rawQuery<{ rows: EstablishmentRow[] }>(
      `
        WITH metric_totals AS (
          SELECT
            metrics.establishment_id,
            SUM(metrics.event_count) FILTER (
              WHERE metrics.event_type = 'catalog_impression'
            )::bigint AS impressions,
            SUM(metrics.event_count) FILTER (
              WHERE metrics.event_type = 'establishment_view'
            )::bigint AS views,
            SUM(metrics.event_count) FILTER (
              WHERE metrics.event_type IN (
                'route_click',
                'whatsapp_click',
                'phone_click',
                'website_click'
              )
            )::bigint AS conversions
          FROM analytics_daily_metrics AS metrics
          INNER JOIN establishments AS establishments
            ON establishments.id = metrics.establishment_id
           AND establishments.tenant_id = metrics.tenant_id
          WHERE metrics.tenant_id = ?
            AND establishments.organization_id = ?
            AND metrics.metric_date BETWEEN ?::date AND ?::date
            ${establishmentFilter}
          GROUP BY metrics.establishment_id
        ),
        session_totals AS (
          SELECT
            sessions.establishment_id,
            COUNT(DISTINCT sessions.anonymous_session_hash)::bigint AS unique_sessions
          FROM analytics_daily_metric_sessions AS sessions
          INNER JOIN establishments AS establishments
            ON establishments.id = sessions.establishment_id
           AND establishments.tenant_id = sessions.tenant_id
          WHERE sessions.tenant_id = ?
            AND establishments.organization_id = ?
            AND sessions.metric_date BETWEEN ?::date AND ?::date
            ${establishmentFilter.replaceAll('metrics.', 'sessions.')}
          GROUP BY sessions.establishment_id
        )
        SELECT
          establishments.id AS establishment_id,
          COALESCE(projection.public_name, 'Unidade ' || establishments.id::text) AS public_name,
          COALESCE(projection.establishment_slug, establishments.id::text) AS slug,
          COALESCE(metric_totals.impressions, 0)::bigint AS impressions,
          COALESCE(metric_totals.views, 0)::bigint AS views,
          COALESCE(metric_totals.conversions, 0)::bigint AS conversions,
          COALESCE(session_totals.unique_sessions, 0)::bigint AS unique_sessions
        FROM establishments
        LEFT JOIN metric_totals ON metric_totals.establishment_id = establishments.id
        LEFT JOIN session_totals ON session_totals.establishment_id = establishments.id
        LEFT JOIN catalog_establishments AS projection
          ON projection.tenant_id = establishments.tenant_id
         AND projection.establishment_id = establishments.id
        WHERE establishments.tenant_id = ?
          AND establishments.organization_id = ?
          ${range.establishmentId ? 'AND establishments.id = ?' : ''}
          AND (
            metric_totals.establishment_id IS NOT NULL
            OR session_totals.establishment_id IS NOT NULL
          )
        ORDER BY conversions DESC, views DESC, impressions DESC, establishments.id ASC
      `,
      [
        tenantId,
        organizationId,
        range.from,
        range.to,
        ...establishmentBindings,
        tenantId,
        organizationId,
        range.from,
        range.to,
        ...establishmentBindings,
        tenantId,
        organizationId,
        ...establishmentBindings,
      ]
    )

    return {
      totals: totalsResult.rows.map((row) => ({
        event_type: row.event_type,
        event_count: Number(row.event_count),
        unique_sessions: Number(row.unique_sessions),
      })),
      series: seriesResult.rows.map((row) => ({
        date: row.date,
        impressions: Number(row.impressions),
        views: Number(row.views),
        conversions: Number(row.conversions),
        unique_sessions: Number(row.unique_sessions),
      })),
      establishments: establishmentsResult.rows.map((row) => ({
        establishment_id: Number(row.establishment_id),
        public_name: row.public_name,
        slug: row.slug,
        impressions: Number(row.impressions),
        views: Number(row.views),
        conversions: Number(row.conversions),
        unique_sessions: Number(row.unique_sessions),
      })),
    }
  }

  async searchTerms(
    tenantId: number,
    query: {
      from: string
      to: string
      cityId?: number
      page: number
      perPage: number
    }
  ): Promise<IAnalytics.SearchTermsPage> {
    const cityFilter = query.cityId ? 'AND terms.city_id = ?' : ''
    const cityBindings = query.cityId ? [query.cityId] : []
    const offset = (query.page - 1) * query.perPage

    const countResult = await db.rawQuery<{ rows: Array<{ total: string | number }> }>(
      `
        SELECT COUNT(*)::bigint AS total
        FROM (
          SELECT terms.city_id, terms.search_term_hash, terms.category_key
          FROM analytics_daily_search_terms AS terms
          WHERE terms.tenant_id = ?
            AND terms.metric_date BETWEEN ?::date AND ?::date
            ${cityFilter}
          GROUP BY terms.city_id, terms.search_term_hash, terms.category_key
        ) AS grouped
      `,
      [tenantId, query.from, query.to, ...cityBindings]
    )

    const rowsResult = await db.rawQuery<{ rows: SearchTermRow[] }>(
      `
        SELECT
          MIN(terms.metric_date)::text AS date,
          terms.city_id,
          cities.name AS city_name,
          MAX(terms.search_term_redacted) AS search_term_redacted,
          NULLIF(terms.category_key, '') AS category_slug,
          SUM(terms.event_count)::bigint AS event_count,
          SUM(terms.unique_sessions)::bigint AS unique_sessions
        FROM analytics_daily_search_terms AS terms
        INNER JOIN cities
          ON cities.id = terms.city_id
         AND cities.tenant_id = terms.tenant_id
        WHERE terms.tenant_id = ?
          AND terms.metric_date BETWEEN ?::date AND ?::date
          ${cityFilter}
        GROUP BY
          terms.city_id,
          cities.name,
          terms.search_term_hash,
          terms.category_key
        ORDER BY event_count DESC, unique_sessions DESC, search_term_redacted ASC
        LIMIT ? OFFSET ?
      `,
      [tenantId, query.from, query.to, ...cityBindings, query.perPage, offset]
    )

    const total = Number(countResult.rows[0]?.total ?? 0)

    return {
      meta: {
        total,
        page: query.page,
        per_page: query.perPage,
        last_page: Math.max(1, Math.ceil(total / query.perPage)),
      },
      data: rowsResult.rows.map((row) => ({
        date: row.date,
        city_id: Number(row.city_id),
        city_name: row.city_name,
        term: row.search_term_redacted,
        category_slug: row.category_slug,
        searches: Number(row.event_count),
        unique_sessions: Number(row.unique_sessions),
      })),
    }
  }
}
