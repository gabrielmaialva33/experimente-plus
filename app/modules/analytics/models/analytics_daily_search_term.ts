import { DateTime } from 'luxon'
import { BaseModel, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'

export default class AnalyticsDailySearchTerm extends BaseModel {
  static table = 'analytics_daily_search_terms'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true, consume: (value) => Number(value) })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare metric_date: string

  @column()
  declare city_id: number

  @column()
  declare search_term_hash: string

  @column()
  declare search_term_redacted: string

  @column()
  declare category_slug: string | null

  @column()
  declare category_key: string

  @column({ consume: (value) => Number(value) })
  declare event_count: number

  @column({ consume: (value) => Number(value) })
  declare unique_sessions: number

  @column.dateTime()
  declare first_event_at: DateTime

  @column.dateTime()
  declare last_event_at: DateTime

  @column.dateTime()
  declare expires_at: DateTime

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime
}
