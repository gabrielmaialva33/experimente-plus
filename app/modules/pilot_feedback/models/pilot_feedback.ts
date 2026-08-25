import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Establishment from '#modules/establishments/models/establishment'
import Organization from '#modules/organizations/models/organization'
import type IPilotFeedback from '#modules/pilot_feedback/interfaces/pilot_feedback_interface'
import User from '#modules/users/models/user'

export default class PilotFeedback extends BaseModel {
  static table = 'pilot_feedback'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare user_id: number

  @column()
  declare organization_id: number | null

  @column()
  declare establishment_id: number | null

  @column()
  declare context: IPilotFeedback.Context

  @column()
  declare rating: number

  @column()
  declare message: string

  @column()
  declare status: IPilotFeedback.Status

  @column()
  declare reviewed_by: number | null

  @column.dateTime()
  declare reviewed_at: DateTime | null

  @column()
  declare internal_notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare author: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'reviewed_by' })
  declare reviewer: BelongsTo<typeof User>

  @belongsTo(() => Organization, { foreignKey: 'organization_id' })
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => Establishment, { foreignKey: 'establishment_id' })
  declare establishment: BelongsTo<typeof Establishment>
}
