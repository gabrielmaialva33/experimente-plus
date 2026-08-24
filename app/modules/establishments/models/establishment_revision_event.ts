import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import type IEstablishmentReview from '#modules/establishments/interfaces/establishment_review_interface'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import User from '#modules/users/models/user'

export default class EstablishmentRevisionEvent extends BaseModel {
  static table = 'establishment_revision_events'
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
  declare event_type: IEstablishmentReview.EventType

  @column()
  declare from_status: IEstablishment.RevisionStatus | null

  @column()
  declare to_status: IEstablishment.RevisionStatus

  @column()
  declare actor_id: number

  @column()
  declare reason: string | null

  @column()
  declare metadata: IEstablishmentReview.EventMetadata | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @belongsTo(() => EstablishmentRevision, { foreignKey: 'revision_id' })
  declare revision: BelongsTo<typeof EstablishmentRevision>

  @belongsTo(() => User, { foreignKey: 'actor_id' })
  declare actor: BelongsTo<typeof User>
}
