import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import Tenant from '#modules/tenants/models/tenant'
import Category from '#modules/taxonomy/models/category'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import type { CategoryAttributeType } from '#modules/taxonomy/interfaces/taxonomy_interface'

export default class CategoryAttributeDefinition extends BaseModel {
  static table = 'category_attribute_definitions'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare category_id: number

  @column()
  declare key: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare data_type: CategoryAttributeType

  @column()
  declare unit: string | null

  @column()
  declare is_required: boolean

  @column()
  declare is_filterable: boolean

  @column()
  declare is_public: boolean

  @column()
  declare applies_to_descendants: boolean

  @column()
  declare sort_order: number

  @column()
  declare is_active: boolean

  @column()
  declare validation_rules: Record<string, unknown>

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => Category, { foreignKey: 'category_id' })
  declare category: BelongsTo<typeof Category>

  @hasMany(() => CategoryAttributeOption, { foreignKey: 'attribute_definition_id' })
  declare options: HasMany<typeof CategoryAttributeOption>
}
