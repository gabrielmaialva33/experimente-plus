import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'category_attribute_options'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table.integer('attribute_definition_id').unsigned().notNullable()
      table.string('label', 120).notNullable()
      table.string('value', 80).notNullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['tenant_id', 'attribute_definition_id', 'value'],
        'category_attribute_options_scope_value_unique'
      )
      table.index(
        ['tenant_id', 'attribute_definition_id', 'is_active', 'sort_order'],
        'category_attribute_options_catalog_index'
      )

      table
        .foreign(
          ['attribute_definition_id', 'tenant_id'],
          'category_attribute_options_definition_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('category_attribute_definitions')
        .onDelete('CASCADE')

      table.check('sort_order >= 0', [], 'category_attribute_options_sort_order_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
