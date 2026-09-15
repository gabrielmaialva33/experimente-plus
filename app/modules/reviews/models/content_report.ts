import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IReview from '#modules/reviews/interfaces/review_interface'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

export default class ContentReport extends BaseModel {
  static table = 'content_reports'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare target_type: IReview.ReportTargetType

  @column()
  declare target_id: number

  @column()
  declare reporter_id: number

  @column()
  declare reason: IReview.ReportReason

  @column()
  declare details: string | null

  @column()
  declare status: IReview.ReportStatus

  @column()
  declare resolved_by: number | null

  @column.dateTime()
  declare resolved_at: DateTime | null

  @column()
  declare resolution_action: string | null

  @column()
  declare resolution_notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User, { foreignKey: 'reporter_id' })
  declare reporter: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'resolved_by' })
  declare resolver: BelongsTo<typeof User>
}
