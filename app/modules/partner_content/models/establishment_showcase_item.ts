import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Establishment from '#modules/establishments/models/establishment'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

export default class EstablishmentShowcaseItem extends BaseModel {
  static table = 'establishment_showcase_items'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare establishment_id: number

  @column()
  declare created_by: number

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare status: 'draft' | 'pending_review' | 'published' | 'archived'

  @column()
  declare informational_price_cents: number | null

  @column()
  declare published_snapshot: Record<string, unknown> | null

  @column.dateTime()
  declare published_at: DateTime | null

  @column()
  declare archived_by: number | null

  @column.dateTime()
  declare archived_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => Establishment, { foreignKey: 'establishment_id' })
  declare establishment: BelongsTo<typeof Establishment>

  @belongsTo(() => User, { foreignKey: 'created_by' })
  declare creator: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'archived_by' })
  declare archiver: BelongsTo<typeof User>
}
