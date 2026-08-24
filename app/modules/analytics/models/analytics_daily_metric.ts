import { DateTime } from 'luxon'
import { BaseModel, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'

import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'

export default class AnalyticsDailyMetric extends BaseModel {
  static table = 'analytics_daily_metrics'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true, consume: (value) => Number(value) })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare metric_date: string

  @column()
  declare event_type: IAnalytics.EstablishmentEventType

  @column()
  declare establishment_id: number

  @column()
  declare city_id: number

  @column()
  declare source: IAnalytics.Source

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
