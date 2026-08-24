import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import Organization from '#modules/organizations/models/organization'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

export default class Establishment extends BaseModel {
  static table = 'establishments'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare organization_id: number

  @column()
  declare lifecycle_status: IEstablishment.LifecycleStatus

  @column()
  declare business_status: IEstablishment.BusinessStatus

  @column()
  declare published_revision_id: number | null

  @column()
  declare created_by: number | null

  @column.dateTime()
  declare suspended_at: DateTime | null

  @column.dateTime()
  declare archived_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => Organization, { foreignKey: 'organization_id' })
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => EstablishmentRevision, { foreignKey: 'published_revision_id' })
  declare published_revision: BelongsTo<typeof EstablishmentRevision>

  @hasMany(() => EstablishmentRevision, { foreignKey: 'establishment_id' })
  declare revisions: HasMany<typeof EstablishmentRevision>
}
