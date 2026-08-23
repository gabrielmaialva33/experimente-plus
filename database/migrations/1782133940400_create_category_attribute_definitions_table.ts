import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'category_attribute_definitions'

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
      table.integer('category_id').unsigned().notNullable()
      table.string('key', 80).notNullable()
      table.string('name', 120).notNullable()
      table.text('description').nullable()
      table.string('data_type', 32).notNullable()
      table.string('unit', 32).nullable()
      table.boolean('is_required').notNullable().defaultTo(false)
      table.boolean('is_filterable').notNullable().defaultTo(false)
      table.boolean('is_public').notNullable().defaultTo(true)
      table.boolean('applies_to_descendants').notNullable().defaultTo(true)
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.jsonb('validation_rules').notNullable().defaultTo('{}')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['tenant_id', 'category_id', 'key'],
        'category_attribute_definitions_scope_key_unique'
      )
      table.unique(['id', 'tenant_id'], 'category_attribute_definitions_id_tenant_unique')
      table.index(
        ['tenant_id', 'category_id', 'is_active', 'sort_order'],
        'category_attribute_definitions_catalog_index'
      )

      table
        .foreign(['category_id', 'tenant_id'], 'category_attribute_definitions_category_foreign')
        .references(['id', 'tenant_id'])
        .inTable('categories')
        .onDelete('CASCADE')

      table.check(
        "data_type IN ('text', 'long_text', 'boolean', 'integer', 'decimal', 'single_select', 'multi_select', 'url')",
        [],
        'category_attribute_definitions_data_type_check'
      )
      table.check('sort_order >= 0', [], 'category_attribute_definitions_sort_order_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
