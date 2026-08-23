import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'regions'

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
      table.string('name', 120).notNullable()
      table.string('slug', 140).notNullable()
      table.text('description').nullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'slug'], 'regions_tenant_id_slug_unique')
      table.unique(['id', 'tenant_id'], 'regions_id_tenant_id_unique')
      table.index(['tenant_id', 'is_active', 'sort_order'], 'regions_catalog_index')
      table.check('sort_order >= 0', [], 'regions_sort_order_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
