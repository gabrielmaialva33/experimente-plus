import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Establishment from '#modules/establishments/models/establishment'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

/**
 * A private bookmark of the Explorer — ADR-0030.
 */
export default class ExplorerFavorite extends BaseModel {
  static table = 'explorer_favorites'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare user_id: number

  @column()
  declare establishment_id: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Establishment, { foreignKey: 'establishment_id' })
  declare establishment: BelongsTo<typeof Establishment>
}
