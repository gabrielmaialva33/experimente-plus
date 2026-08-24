import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IEstablishmentReview from '#modules/establishments/interfaces/establishment_review_interface'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import User from '#modules/users/models/user'

export default class EstablishmentRevisionReviewIssue extends BaseModel {
  static table = 'establishment_revision_review_issues'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare establishment_id: number

  @column()
  declare revision_id: number

  @column()
  declare code: string

  @column()
  declare field: string

  @column()
  declare message: string

  @column()
  declare severity: IEstablishmentReview.IssueSeverity

  @column()
  declare created_by: number

  @column()
  declare resolved_by: number | null

  @column.dateTime()
  declare resolved_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @belongsTo(() => EstablishmentRevision, { foreignKey: 'revision_id' })
  declare revision: BelongsTo<typeof EstablishmentRevision>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'resolved_by' })
  declare resolver: BelongsTo<typeof User>
}
