import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionSpecialHour from '#modules/establishments/models/establishment_revision_special_hour'
import Tenant from '#modules/tenants/models/tenant'

export default class EstablishmentRevisionSpecialDay extends BaseModel {
  static table = 'establishment_revision_special_days'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare revision_id: number

  @column()
  declare date: string

  @column()
  declare status: IEstablishment.SpecialDayStatus

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => EstablishmentRevision, { foreignKey: 'revision_id' })
  declare revision: BelongsTo<typeof EstablishmentRevision>

  @hasMany(() => EstablishmentRevisionSpecialHour, { foreignKey: 'special_day_id' })
  declare intervals: HasMany<typeof EstablishmentRevisionSpecialHour>
}
