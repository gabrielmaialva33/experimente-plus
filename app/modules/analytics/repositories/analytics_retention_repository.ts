import db from '@adonisjs/lucid/services/db'

import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'

export default class AnalyticsRetentionRepository {
  async prune(): Promise<IAnalytics.RetentionResult> {
    return db.transaction(async (client) => {
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
    })
  }
}
