import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'

export interface AnalyticsEventInsert {
  tenant_id: number
  event_id: string
  event_type: IAnalytics.EventType
  establishment_id: number | null
  published_revision_id: number | null
  city_id: number
  metric_date: string
  anonymous_session_hash: string
  dedupe_key: string
  source: IAnalytics.Source
  search_term_redacted: string | null
  search_term_hash: string | null
  category_slug: string | null
  metadata: Record<string, unknown> | null
  occurred_at: DateTime
  expires_at: DateTime
}

export default class AnalyticsEventRepository {
  async insertEvent(
    data: AnalyticsEventInsert,
    client: TransactionClientContract
  ): Promise<boolean> {
    const result = await client.rawQuery(
      `
        INSERT INTO analytics_events (
          tenant_id,
          event_id,
          event_type,
          establishment_id,
          published_revision_id,
          city_id,
          metric_date,
          anonymous_session_hash,
          dedupe_key,
          source,
          search_term_redacted,
          search_term_hash,
          category_slug,
          metadata,
          occurred_at,
          expires_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?)
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      [
        data.tenant_id,
        data.event_id,
        data.event_type,
        data.establishment_id,
        data.published_revision_id,
        data.city_id,
        data.metric_date,
        data.anonymous_session_hash,
        data.dedupe_key,
        data.source,
        data.search_term_redacted,
        data.search_term_hash,
        data.category_slug,
        data.metadata === null ? null : JSON.stringify(data.metadata),
        data.occurred_at.toJSDate(),
        data.expires_at.toJSDate(),
        data.occurred_at.toJSDate(),
      ] as any
    )

    return result.rows.length > 0
  }

  async aggregateEstablishmentEvent(
    data: AnalyticsEventInsert & {
      establishment_id: number
      event_type: IAnalytics.EstablishmentEventType
    },
    aggregateExpiresAt: DateTime,
    client: TransactionClientContract
  ): Promise<void> {
    const sessionResult = await client.rawQuery(
      `
        INSERT INTO analytics_daily_metric_sessions (
          tenant_id,
          metric_date,
          event_type,
          establishment_id,
          source,
          anonymous_session_hash,
          expires_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      [
        data.tenant_id,
        data.metric_date,
        data.event_type,
        data.establishment_id,
        data.source,
        data.anonymous_session_hash,
        aggregateExpiresAt.toJSDate(),
        data.occurred_at.toJSDate(),
      ]
    )
    const uniqueSessionIncrement = sessionResult.rows.length > 0 ? 1 : 0

    await client.rawQuery(
      `
        INSERT INTO analytics_daily_metrics (
          tenant_id,
          metric_date,
          event_type,
          establishment_id,
          city_id,
          source,
          event_count,
          unique_sessions,
          first_event_at,
          last_event_at,
          expires_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (tenant_id, metric_date, event_type, establishment_id, source)
        DO UPDATE SET
          event_count = analytics_daily_metrics.event_count + 1,
          unique_sessions = analytics_daily_metrics.unique_sessions + EXCLUDED.unique_sessions,
          first_event_at = LEAST(analytics_daily_metrics.first_event_at, EXCLUDED.first_event_at),
          last_event_at = GREATEST(analytics_daily_metrics.last_event_at, EXCLUDED.last_event_at),
          expires_at = GREATEST(analytics_daily_metrics.expires_at, EXCLUDED.expires_at),
          updated_at = EXCLUDED.updated_at
      `,
      [
        data.tenant_id,
        data.metric_date,
        data.event_type,
        data.establishment_id,
        data.city_id,
        data.source,
        uniqueSessionIncrement,
        data.occurred_at.toJSDate(),
        data.occurred_at.toJSDate(),
        aggregateExpiresAt.toJSDate(),
        data.occurred_at.toJSDate(),
        data.occurred_at.toJSDate(),
      ]
    )
  }

  async aggregateSearchWithoutResults(
    data: AnalyticsEventInsert & {
      event_type: 'search_without_results'
      search_term_hash: string
      search_term_redacted: string
    },
    aggregateExpiresAt: DateTime,
    client: TransactionClientContract
  ): Promise<void> {
    const categoryKey = data.category_slug ?? ''
    const sessionResult = await client.rawQuery(
      `
        INSERT INTO analytics_daily_search_sessions (
          tenant_id,
          metric_date,
          city_id,
          search_term_hash,
          category_key,
          anonymous_session_hash,
          expires_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      [
        data.tenant_id,
        data.metric_date,
        data.city_id,
        data.search_term_hash,
        categoryKey,
        data.anonymous_session_hash,
        aggregateExpiresAt.toJSDate(),
        data.occurred_at.toJSDate(),
      ]
    )
    const uniqueSessionIncrement = sessionResult.rows.length > 0 ? 1 : 0

    await client.rawQuery(
      `
        INSERT INTO analytics_daily_search_terms (
          tenant_id,
          metric_date,
          city_id,
          search_term_hash,
          search_term_redacted,
          category_slug,
          category_key,
          event_count,
          unique_sessions,
          first_event_at,
          last_event_at,
          expires_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (tenant_id, metric_date, city_id, search_term_hash, category_key)
        DO UPDATE SET
          search_term_redacted = EXCLUDED.search_term_redacted,
          event_count = analytics_daily_search_terms.event_count + 1,
          unique_sessions = analytics_daily_search_terms.unique_sessions + EXCLUDED.unique_sessions,
          first_event_at = LEAST(analytics_daily_search_terms.first_event_at, EXCLUDED.first_event_at),
          last_event_at = GREATEST(analytics_daily_search_terms.last_event_at, EXCLUDED.last_event_at),
          expires_at = GREATEST(analytics_daily_search_terms.expires_at, EXCLUDED.expires_at),
          updated_at = EXCLUDED.updated_at
      `,
      [
        data.tenant_id,
        data.metric_date,
        data.city_id,
        data.search_term_hash,
        data.search_term_redacted,
        data.category_slug,
        categoryKey,
        uniqueSessionIncrement,
        data.occurred_at.toJSDate(),
        data.occurred_at.toJSDate(),
        aggregateExpiresAt.toJSDate(),
        data.occurred_at.toJSDate(),
        data.occurred_at.toJSDate(),
      ] as any
    )
  }
}
