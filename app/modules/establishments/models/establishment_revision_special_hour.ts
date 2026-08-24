import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import EstablishmentRevisionSpecialDay from '#modules/establishments/models/establishment_revision_special_day'
import Tenant from '#modules/tenants/models/tenant'

export default class EstablishmentRevisionSpecialHour extends BaseModel {
  static table = 'establishment_revision_special_hours'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare special_day_id: number

  @column()
  declare revision_id: number

  @column()
  declare opens_at: string

  @column()
  declare closes_at: string

  @column()
  declare spans_next_day: boolean

  @column()
  declare sort_order: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => EstablishmentRevisionSpecialDay, { foreignKey: 'special_day_id' })
  declare special_day: BelongsTo<typeof EstablishmentRevisionSpecialDay>
}
