import { DateTime } from 'luxon'
import {
  BaseModel,
  belongsTo,
  column,
  hasMany,
  hasOne,
  SnakeCaseNamingStrategy,
} from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'

import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import EstablishmentRevisionCategory from '#modules/establishments/models/establishment_revision_category'
import EstablishmentRevisionHour from '#modules/establishments/models/establishment_revision_hour'
import EstablishmentRevisionEvent from '#modules/establishments/models/establishment_revision_event'
import EstablishmentRevisionReviewIssue from '#modules/establishments/models/establishment_revision_review_issue'
import EstablishmentRevisionSpecialDay from '#modules/establishments/models/establishment_revision_special_day'
import City from '#modules/geography/models/city'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import User from '#modules/users/models/user'

export default class EstablishmentRevision extends BaseModel {
  static table = 'establishment_revisions'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare establishment_id: number

  @column()
  declare version: number

  @column()
  declare status: IEstablishment.RevisionStatus

  @column()
  declare city_id: number | null

  @column()
  declare public_name: string | null

  @column()
  declare slug: string | null

  @column()
  declare short_description: string | null

  @column()
  declare description: string | null

  @column()
  declare public_phone: string | null

  @column()
  declare whatsapp: string | null

  @column()
  declare public_email: string | null

  @column()
  declare website: string | null

  @column()
  declare instagram: string | null

  @column()
  declare booking_url: string | null

  @column()
  declare availability_type: IEstablishment.AvailabilityType | null

  @column()
  declare based_on_revision_id: number | null

  @column()
  declare created_by: number | null

  @column.dateTime()
  declare submitted_at: DateTime | null

  @column()
  declare reviewed_by: number | null

  @column.dateTime()
  declare reviewed_at: DateTime | null

  @column()
  declare review_notes: string | null

  @column()
  declare rules_version: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Establishment, { foreignKey: 'establishment_id' })
  declare establishment: BelongsTo<typeof Establishment>

  @belongsTo(() => City, { foreignKey: 'city_id' })
  declare city: BelongsTo<typeof City>

  @belongsTo(() => EstablishmentRevision, { foreignKey: 'based_on_revision_id' })
  declare based_on_revision: BelongsTo<typeof EstablishmentRevision>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'reviewed_by' })
  declare reviewer: BelongsTo<typeof User>

  @hasOne(() => EstablishmentRevisionAddress, { foreignKey: 'revision_id' })
  declare address: HasOne<typeof EstablishmentRevisionAddress>

  @hasMany(() => EstablishmentRevisionCategory, { foreignKey: 'revision_id' })
  declare categories: HasMany<typeof EstablishmentRevisionCategory>

  @hasMany(() => EstablishmentRevisionAttributeValue, { foreignKey: 'revision_id' })
  declare attribute_values: HasMany<typeof EstablishmentRevisionAttributeValue>

  @hasMany(() => EstablishmentRevisionHour, { foreignKey: 'revision_id' })
  declare hours: HasMany<typeof EstablishmentRevisionHour>

  @hasMany(() => EstablishmentRevisionSpecialDay, { foreignKey: 'revision_id' })
  declare special_days: HasMany<typeof EstablishmentRevisionSpecialDay>

  @hasMany(() => EstablishmentRevisionEvent, { foreignKey: 'revision_id' })
  declare events: HasMany<typeof EstablishmentRevisionEvent>

  @hasMany(() => EstablishmentRevisionReviewIssue, { foreignKey: 'revision_id' })
  declare review_issues: HasMany<typeof EstablishmentRevisionReviewIssue>

  @hasMany(() => EstablishmentRevisionMedia, { foreignKey: 'revision_id' })
  declare media: HasMany<typeof EstablishmentRevisionMedia>
}
