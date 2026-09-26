import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Tenant from '#modules/tenants/models/tenant'

/** The Concierge parameters of one operation — ADR-0029, revision of 26/09/2026. */
export default class ConciergePolicy extends BaseModel {
  static table = 'concierge_policies'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare enabled: boolean

  @column()
  declare max_catalog_items: number

  @column()
  declare daily_questions_per_person: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>
}
