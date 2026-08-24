import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import Category from '#modules/taxonomy/models/category'
import Tenant from '#modules/tenants/models/tenant'

export default class EstablishmentRevisionCategory extends BaseModel {
  static table = 'establishment_revision_categories'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare revision_id: number

  @column()
  declare category_id: number

  @column()
  declare is_primary: boolean

  @column()
  declare sort_order: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => EstablishmentRevision, { foreignKey: 'revision_id' })
  declare revision: BelongsTo<typeof EstablishmentRevision>

  @belongsTo(() => Category, { foreignKey: 'category_id' })
  declare category: BelongsTo<typeof Category>
}
