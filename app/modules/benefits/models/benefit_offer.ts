import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IBenefit from '#modules/benefits/interfaces/benefit_interface'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import Establishment from '#modules/establishments/models/establishment'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

export default class BenefitOffer extends BaseModel {
  static table = 'benefit_offers'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare edition_id: number

  @column()
  declare establishment_id: number

  @column()
  declare title: string

  @column()
  declare description: string

  @column()
  declare benefit_type: IBenefit.Type

  @column()
  declare discount_percentage: number | null

  @column()
  declare discount_amount_cents: number | null

  @column()
  declare terms: string | null

  @column()
  declare available_weekdays_mask: number

  @column()
  declare daily_start_time: string | null

  @column()
  declare daily_end_time: string | null

  @column.dateTime()
  declare starts_at: DateTime | null

  @column.dateTime()
  declare ends_at: DateTime | null

  @column()
  declare reservation_required: boolean

  @column()
  declare on_premise_only: boolean

  @column()
  declare minimum_party_size: number

  @column()
  declare max_redemptions_per_access: number

  @column()
  declare status: IBenefit.OfferStatus

  @column()
  declare created_by: number | null

  @column.dateTime()
  declare activated_at: DateTime | null

  @column.dateTime()
  declare archived_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => BenefitEdition, { foreignKey: 'edition_id' })
  declare edition: BelongsTo<typeof BenefitEdition>

  @belongsTo(() => Establishment, { foreignKey: 'establishment_id' })
  declare establishment: BelongsTo<typeof Establishment>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>
}
