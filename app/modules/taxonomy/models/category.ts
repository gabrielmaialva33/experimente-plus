import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import Tenant from '#modules/tenants/models/tenant'
import CategoryFamily from '#modules/taxonomy/models/category_family'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'

export default class Category extends BaseModel {
  static table = 'categories'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare family_id: number

  @column()
  declare parent_id: number | null

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column()
  declare icon: string | null

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

  @belongsTo(() => CategoryFamily, { foreignKey: 'family_id' })
  declare family: BelongsTo<typeof CategoryFamily>

  @belongsTo(() => Category, { foreignKey: 'parent_id' })
  declare parent: BelongsTo<typeof Category>

  @hasMany(() => Category, { foreignKey: 'parent_id' })
  declare children: HasMany<typeof Category>

  @hasMany(() => CategoryAttributeDefinition, { foreignKey: 'category_id' })
  declare attribute_definitions: HasMany<typeof CategoryAttributeDefinition>
}
