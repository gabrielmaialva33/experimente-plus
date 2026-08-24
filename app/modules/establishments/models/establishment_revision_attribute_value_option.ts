import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import Tenant from '#modules/tenants/models/tenant'

export default class EstablishmentRevisionAttributeValueOption extends BaseModel {
  static table = 'establishment_revision_attribute_value_options'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare attribute_value_id: number

  @column()
  declare attribute_definition_id: number

  @column()
  declare attribute_option_id: number

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => EstablishmentRevisionAttributeValue, { foreignKey: 'attribute_value_id' })
  declare attribute_value: BelongsTo<typeof EstablishmentRevisionAttributeValue>

  @belongsTo(() => CategoryAttributeOption, { foreignKey: 'attribute_option_id' })
  declare option: BelongsTo<typeof CategoryAttributeOption>
}
