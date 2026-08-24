import { DateTime } from 'luxon'
import { BaseModel, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'

import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'

export default class AnalyticsEvent extends BaseModel {
  static table = 'analytics_events'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true, consume: (value) => Number(value) })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare event_id: string

  @column()
  declare event_type: IAnalytics.EventType

  @column()
  declare establishment_id: number | null

  @column()
  declare published_revision_id: number | null

  @column()
  declare city_id: number

  @column()
  declare metric_date: string

  @column()
  declare anonymous_session_hash: string

  @column()
  declare dedupe_key: string

  @column()
  declare source: IAnalytics.Source

  @column()
  declare search_term_redacted: string | null

  @column()
  declare search_term_hash: string | null

  @column()
  declare category_slug: string | null

  @column()
  declare metadata: Record<string, unknown> | null

  @column.dateTime()
  declare occurred_at: DateTime

  @column.dateTime()
  declare expires_at: DateTime

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime
}
