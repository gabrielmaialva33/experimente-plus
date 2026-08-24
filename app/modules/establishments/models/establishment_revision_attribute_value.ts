import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionAttributeValueOption from '#modules/establishments/models/establishment_revision_attribute_value_option'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import Tenant from '#modules/tenants/models/tenant'

export default class EstablishmentRevisionAttributeValue extends BaseModel {
  static table = 'establishment_revision_attribute_values'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tenant_id: number

  @column()
  declare revision_id: number

  @column()
  declare attribute_definition_id: number

  @column()
  declare value_text: string | null

  @column()
  declare value_boolean: boolean | null

  @column()
  declare value_integer: number | null

  @column()
  declare value_decimal: number | null

  @column()
  declare value_url: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @belongsTo(() => Tenant, { foreignKey: 'tenant_id' })
  declare tenant: BelongsTo<typeof Tenant>

  @belongsTo(() => EstablishmentRevision, { foreignKey: 'revision_id' })
  declare revision: BelongsTo<typeof EstablishmentRevision>

  @belongsTo(() => CategoryAttributeDefinition, { foreignKey: 'attribute_definition_id' })
  declare definition: BelongsTo<typeof CategoryAttributeDefinition>

  @hasMany(() => EstablishmentRevisionAttributeValueOption, { foreignKey: 'attribute_value_id' })
  declare selected_options: HasMany<typeof EstablishmentRevisionAttributeValueOption>
}
