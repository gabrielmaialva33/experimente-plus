import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Tenant from '#modules/tenants/models/tenant'

export default class ReviewPolicy extends BaseModel {
  static table = 'review_policies'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare require_visit_proof: boolean

  @column()
  declare min_text_length: number

  @column()
  declare max_text_length: number

  @column()
  declare max_photos: number

  @column()
  declare max_videos: number

  @column()
  declare daily_limit_per_user: number

  @column()
  declare min_edit_interval_minutes: number

  @column()
  declare edit_window_days: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>
}
