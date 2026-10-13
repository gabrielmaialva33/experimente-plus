import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'

type SessionDiscardCounts = Omit<IAnalytics.SessionDiscardResult, 'applied' | 'sessions_requested'>

interface DiscardedEventRow {
  tenant_id: number
  metric_date: string
  event_type: IAnalytics.EventType
  establishment_id: number | null
  city_id: number
  source: IAnalytics.Source
  anonymous_session_hash: string
  search_term_hash: string | null
  category_slug: string | null
}

/** What one session added to one daily aggregate row: its events and its session row. */
interface Contribution {
  dimensions: Array<string | number>
  anonymous_session_hash: string
  events: number
}

interface AggregateCorrection {
  sessions_deleted: string | number
  adjusted_ids: Array<string | number>
}

export default class AnalyticsRetentionRepository {
  /**
   * Deletes every expired analytics row. Must run inside a transaction: the
   * retention flag is set with `set_config(..., true)`, which lasts only until
   * the end of the caller's transaction.
   */
  async prune(client: TransactionClientContract): Promise<IAnalytics.RetentionResult> {
    await client.rawQuery("SELECT set_config('app.analytics_retention', 'on', true)")

    const rawEvents = await client.rawQuery<{ rows: Array<{ id: number }> }>(
      `
        DELETE FROM analytics_events
        WHERE expires_at <= NOW()
        RETURNING id
      `
    )

    const metricSessions = await client.rawQuery<{ rows: Array<{ id: number }> }>(
      `
        DELETE FROM analytics_daily_metric_sessions
        WHERE expires_at <= NOW()
        RETURNING id
      `
    )

    const searchSessions = await client.rawQuery<{ rows: Array<{ id: number }> }>(
      `
        DELETE FROM analytics_daily_search_sessions
        WHERE expires_at <= NOW()
        RETURNING id
      `
    )

    const metrics = await client.rawQuery<{ rows: Array<{ id: number }> }>(
      `
        DELETE FROM analytics_daily_metrics
        WHERE expires_at <= NOW()
        RETURNING id
      `
    )

    const searchTerms = await client.rawQuery<{ rows: Array<{ id: number }> }>(
      `
        DELETE FROM analytics_daily_search_terms
        WHERE expires_at <= NOW()
        RETURNING id
      `
    )

    return {
      raw_events_deleted: rawEvents.rows.length,
      metric_sessions_deleted: metricSessions.rows.length,
      metrics_deleted: metrics.rows.length,
      search_sessions_deleted: searchSessions.rows.length,
      search_terms_deleted: searchTerms.rows.length,
    }
  }

  /**
   * Deletes the raw events of the given anonymous sessions and takes back from
   * every daily aggregate exactly what those events added when they were
   * recorded: one per event from `event_count`, one per session row from
   * `unique_sessions`. Aggregate rows left without events are deleted and the
   * first/last timestamps of the others are recomputed from the raw events that
   * remain, so the aggregates equal a recomputation from the raw table.
   *
   * Daily session rows whose raw events retention already removed are left
   * alone and only counted: what they added can no longer be known. Running it
   * again finds nothing. Must run inside a transaction, like `prune`.
   */
  async discardSessions(
    sessionHashes: string[],
    client: TransactionClientContract
  ): Promise<SessionDiscardCounts> {
    await client.rawQuery("SELECT set_config('app.analytics_retention', 'on', true)")

    const deleted = await client.rawQuery<{ rows: DiscardedEventRow[] }>(
      `
        DELETE FROM analytics_events
        WHERE anonymous_session_hash = ANY(?::text[])
        RETURNING
          tenant_id,
          metric_date::text AS metric_date,
          event_type,
          establishment_id,
          city_id,
          source,
          anonymous_session_hash,
          search_term_hash,
          category_slug
      `,
      [[...sessionHashes]]
    )
    const events = deleted.rows

    const metrics = await this.correctAggregates(
      DAILY_METRICS,
      contributionsOf(
        events.filter((event) => event.establishment_id !== null),
        (event) => [
          event.tenant_id,
          event.metric_date,
          event.event_type,
          event.establishment_id!,
          event.source,
        ]
      ),
      client
    )
    const searchTerms = await this.correctAggregates(
      DAILY_SEARCH_TERMS,
      contributionsOf(
        events.filter((event) => event.search_term_hash !== null),
        (event) => [
          event.tenant_id,
          event.metric_date,
          event.city_id,
          event.search_term_hash!,
          event.category_slug ?? '',
        ]
      ),
      client
    )

    const leftovers = await client.rawQuery<{ rows: Array<{ total: string | number }> }>(
      `
        SELECT
          (SELECT COUNT(*) FROM analytics_daily_metric_sessions WHERE anonymous_session_hash = ANY(?::text[]))
          + (SELECT COUNT(*) FROM analytics_daily_search_sessions WHERE anonymous_session_hash = ANY(?::text[]))
          AS total
      `,
      [[...sessionHashes], [...sessionHashes]]
    )

    const byType: Partial<Record<IAnalytics.EventType, number>> = {}
    for (const event of events) {
      byType[event.event_type] = (byType[event.event_type] ?? 0) + 1
    }

    return {
      sessions_found: new Set(events.map((event) => event.anonymous_session_hash)).size,
      raw_events_deleted: events.length,
      raw_events_by_type: byType,
      metric_sessions_deleted: metrics.sessions_deleted,
      metrics_adjusted: metrics.adjusted,
      metrics_deleted: metrics.deleted,
      search_sessions_deleted: searchTerms.sessions_deleted,
      search_terms_adjusted: searchTerms.adjusted,
      search_terms_deleted: searchTerms.deleted,
      aggregate_sessions_without_raw_events: Number(leftovers.rows[0]?.total ?? 0),
    }
  }

  private async correctAggregates(
    table: AggregateTable,
    contributions: Contribution[],
    client: TransactionClientContract
  ): Promise<{ sessions_deleted: number; adjusted: number; deleted: number }> {
    if (contributions.length === 0) {
      return { sessions_deleted: 0, adjusted: 0, deleted: 0 }
    }

    const columns = table.dimensions.map(([column]) => column)
    const list = columns.join(', ')
    const same = (left: string, right: string) =>
      columns.map((column) => `${left}.${column} = ${right}.${column}`).join(' AND ')

    // The session rows are deleted per (dimensions, session) pair actually
    // discarded; the aggregate loses the events and the session rows it gained.
    const correction = await client.rawQuery<{ rows: AggregateCorrection[] }>(
      `
        WITH discarded AS (
          SELECT *
          FROM unnest(${table.dimensions.map(([, type]) => `?::${type}[]`).join(', ')}, ?::text[], ?::integer[])
            AS discarded(${list}, anonymous_session_hash, events)
        ),
        removed_sessions AS (
          DELETE FROM ${table.sessions} AS stored
          USING discarded
          WHERE ${same('stored', 'discarded')}
            AND stored.anonymous_session_hash = discarded.anonymous_session_hash
          RETURNING ${columns.map((column) => `stored.${column}`).join(', ')}
        ),
        contributions AS (
          SELECT ${list}, SUM(events) AS events
          FROM discarded
          GROUP BY ${list}
        ),
        session_counts AS (
          SELECT ${list}, COUNT(*) AS sessions
          FROM removed_sessions
          GROUP BY ${list}
        ),
        adjusted AS (
          UPDATE ${table.aggregates} AS daily
          SET
            event_count = daily.event_count - contribution.events,
            unique_sessions = daily.unique_sessions - COALESCE(session_count.sessions, 0),
            updated_at = NOW()
          FROM contributions AS contribution
          LEFT JOIN session_counts AS session_count USING (${list})
          WHERE ${same('daily', 'contribution')}
          RETURNING daily.id
        )
        SELECT
          (SELECT COUNT(*) FROM removed_sessions) AS sessions_deleted,
          ARRAY(SELECT id FROM adjusted) AS adjusted_ids
      `,
      // One homogeneous array per column; the driver sends each as a PostgreSQL array.
      [
        ...columns.map((_, index) => contributions.map((item) => item.dimensions[index])),
        contributions.map((item) => item.anonymous_session_hash),
        contributions.map((item) => item.events),
      ] as any
    )
    const adjustedIds = (correction.rows[0]?.adjusted_ids ?? []).map(Number)

    const emptied = await client.rawQuery<{ rows: Array<{ id: number }> }>(
      `
        DELETE FROM ${table.aggregates}
        WHERE id = ANY(?::bigint[])
          AND event_count = 0
        RETURNING id
      `,
      [adjustedIds]
    )

    // Only where the remaining raw events account for every counted event: a
    // day partly past raw retention keeps the timestamps it has.
    await client.rawQuery(
      `
        UPDATE ${table.aggregates} AS daily
        SET first_event_at = remaining.first_event_at, last_event_at = remaining.last_event_at
        FROM (
          SELECT
            kept.id,
            MIN(raw.occurred_at) AS first_event_at,
            MAX(raw.occurred_at) AS last_event_at,
            COUNT(*) AS events
          FROM ${table.aggregates} AS kept
          JOIN analytics_events AS raw ON ${table.rawMatch}
          WHERE kept.id = ANY(?::bigint[])
          GROUP BY kept.id
        ) AS remaining
        WHERE daily.id = remaining.id
          AND remaining.events = daily.event_count
      `,
      [adjustedIds]
    )

    return {
      sessions_deleted: Number(correction.rows[0]?.sessions_deleted ?? 0),
      adjusted: adjustedIds.length - emptied.rows.length,
      deleted: emptied.rows.length,
    }
  }
}

/**
 * A daily aggregate and the session rows behind its `unique_sessions`. Fixed
 * identifiers only: the SQL above is built from these, never from input.
 */
interface AggregateTable {
  aggregates: 'analytics_daily_metrics' | 'analytics_daily_search_terms'
  sessions: 'analytics_daily_metric_sessions' | 'analytics_daily_search_sessions'
  /** The aggregate's unique dimensions without the session, with their SQL types. */
  dimensions: Array<[column: string, type: 'integer' | 'date' | 'text']>
  /** Joins `raw` (analytics_events) to the `kept` aggregate row it was counted in. */
  rawMatch: string
}

const DAILY_METRICS: AggregateTable = {
  aggregates: 'analytics_daily_metrics',
  sessions: 'analytics_daily_metric_sessions',
  dimensions: [
    ['tenant_id', 'integer'],
    ['metric_date', 'date'],
    ['event_type', 'text'],
    ['establishment_id', 'integer'],
    ['source', 'text'],
  ],
  rawMatch: `
    raw.tenant_id = kept.tenant_id
    AND raw.metric_date = kept.metric_date
    AND raw.event_type = kept.event_type
    AND raw.establishment_id = kept.establishment_id
    AND raw.source = kept.source
  `,
}

const DAILY_SEARCH_TERMS: AggregateTable = {
  aggregates: 'analytics_daily_search_terms',
  sessions: 'analytics_daily_search_sessions',
  dimensions: [
    ['tenant_id', 'integer'],
    ['metric_date', 'date'],
    ['city_id', 'integer'],
    ['search_term_hash', 'text'],
    ['category_key', 'text'],
  ],
  rawMatch: `
    raw.tenant_id = kept.tenant_id
    AND raw.metric_date = kept.metric_date
    AND raw.event_type = 'search_without_results'
    AND raw.city_id = kept.city_id
    AND raw.search_term_hash = kept.search_term_hash
    AND COALESCE(raw.category_slug, '') = kept.category_key
  `,
}

/** Groups deleted raw events by aggregate dimensions and session. */
function contributionsOf(
  events: DiscardedEventRow[],
  dimensionsOf: (event: DiscardedEventRow) => Array<string | number>
): Contribution[] {
  const contributions = new Map<string, Contribution>()

  for (const event of events) {
    const dimensions = dimensionsOf(event)
    const key = JSON.stringify([...dimensions, event.anonymous_session_hash])
    const existing = contributions.get(key)

    if (existing) {
      existing.events += 1
    } else {
      contributions.set(key, {
        dimensions,
        anonymous_session_hash: event.anonymous_session_hash,
        events: 1,
      })
    }
  }

  return [...contributions.values()]
}
