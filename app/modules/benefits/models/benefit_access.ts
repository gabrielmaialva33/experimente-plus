import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import type IBenefitAccess from '#modules/benefits/interfaces/benefit_access_interface'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

export default class BenefitAccess extends BaseModel {
  static table = 'benefit_accesses'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare edition_id: number

  @column()
  declare user_id: number

  @column()
  declare source: IBenefitAccess.Source

  @column()
  declare status: IBenefitAccess.Status

  @column()
  declare external_reference: string | null

  @column()
  declare notes: string | null

  @column()
  declare granted_by: number | null

  @column.dateTime()
  declare granted_at: DateTime

  @column()
  declare revoked_by: number | null

  @column.dateTime()
  declare revoked_at: DateTime | null

  @column()
  declare revocation_reason: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => BenefitEdition, { foreignKey: 'edition_id' })
  declare edition: BelongsTo<typeof BenefitEdition>

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare holder: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'granted_by' })
  declare granter: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'revoked_by' })
  declare revoker: BelongsTo<typeof User>
}
