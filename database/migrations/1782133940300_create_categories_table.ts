import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'categories'

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
      table.integer('family_id').unsigned().notNullable()
      table.integer('parent_id').unsigned().nullable()
      table.string('name', 120).notNullable()
      table.string('slug', 140).notNullable()
      table.text('description').nullable()
      table.string('icon', 80).nullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.boolean('allows_always_open').notNullable().defaultTo(false)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'slug'], 'categories_tenant_id_slug_unique')
      table.unique(['id', 'tenant_id'], 'categories_id_tenant_id_unique')
      table.unique(['id', 'tenant_id', 'family_id'], 'categories_id_tenant_id_family_id_unique')
      table.index(
        ['tenant_id', 'family_id', 'parent_id', 'is_active', 'sort_order'],
        'categories_catalog_index'
      )

      table
        .foreign(['family_id', 'tenant_id'], 'categories_family_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('category_families')
        .onDelete('RESTRICT')

      table
        .foreign(['parent_id', 'tenant_id', 'family_id'], 'categories_parent_tenant_family_foreign')
        .references(['id', 'tenant_id', 'family_id'])
        .inTable('categories')
        .onDelete('RESTRICT')

      table.check('sort_order >= 0', [], 'categories_sort_order_check')
      table.check('parent_id IS NULL OR parent_id <> id', [], 'categories_parent_not_self_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
