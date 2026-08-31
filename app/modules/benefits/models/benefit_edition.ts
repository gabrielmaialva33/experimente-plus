import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import type IBenefit from '#modules/benefits/interfaces/benefit_interface'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import City from '#modules/geography/models/city'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

export default class BenefitEdition extends BaseModel {
  static table = 'benefit_editions'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare city_id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column()
  declare price_cents: number

  @column()
  declare currency: string

  @column.dateTime()
  declare sales_starts_at: DateTime | null

  @column.dateTime()
  declare sales_ends_at: DateTime | null

  @column.dateTime()
  declare usage_starts_at: DateTime

  @column.dateTime()
  declare usage_ends_at: DateTime

  @column()
  declare status: IBenefit.EditionStatus

  @column()
  declare created_by: number | null

  @column.dateTime()
  declare published_at: DateTime | null

  @column.dateTime()
  declare archived_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => City, { foreignKey: 'city_id' })
  declare city: BelongsTo<typeof City>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @hasMany(() => BenefitOffer, { foreignKey: 'edition_id' })
  declare offers: HasMany<typeof BenefitOffer>

  @hasMany(() => BenefitAccess, { foreignKey: 'edition_id' })
  declare accesses: HasMany<typeof BenefitAccess>
}
