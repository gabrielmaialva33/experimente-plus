import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import Tenant from '#modules/tenants/models/tenant'

export default class EstablishmentRevisionAddress extends BaseModel {
  static table = 'establishment_revision_addresses'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare revision_id: number

  @column()
  declare postal_code: string | null

  @column()
  declare street: string | null

  @column()
  declare number: string | null

  @column()
  declare without_number: boolean

  @column()
  declare complement: string | null

  @column()
  declare district: string | null

  @column()
  declare reference: string | null

  @column()
  declare latitude: number | null

  @column()
  declare longitude: number | null

  @column()
  declare coordinate_source: IEstablishment.CoordinateSource | null

  @column.dateTime()
  declare geocoded_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => EstablishmentRevision, { foreignKey: 'revision_id' })
  declare revision: BelongsTo<typeof EstablishmentRevision>
}
