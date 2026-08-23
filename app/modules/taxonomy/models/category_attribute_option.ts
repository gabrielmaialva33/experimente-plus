import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Tenant from '#modules/tenants/models/tenant'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'

export default class CategoryAttributeOption extends BaseModel {
  static table = 'category_attribute_options'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare attribute_definition_id: number

  @column()
  declare label: string

  @column()
  declare value: string

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

  @belongsTo(() => CategoryAttributeDefinition, {
    foreignKey: 'attribute_definition_id',
  })
  declare attribute_definition: BelongsTo<typeof CategoryAttributeDefinition>
}
