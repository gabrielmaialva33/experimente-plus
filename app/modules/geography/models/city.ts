import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Tenant from '#modules/tenants/models/tenant'
import Region from '#modules/geography/models/region'

export default class City extends BaseModel {
  static table = 'cities'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare region_id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare state_code: string

  @column()
  declare country_code: string

  @column()
  declare ibge_code: string | null

  @column()
  declare timezone: string

  @column({ consume: (value) => (value === null ? null : Number(value)) })
  declare latitude: number | null

  @column({ consume: (value) => (value === null ? null : Number(value)) })
  declare longitude: number | null

  @column()
  declare sort_order: number

  @column()
  declare is_active: boolean

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => Region, { foreignKey: 'region_id' })
  declare region: BelongsTo<typeof Region>
}
