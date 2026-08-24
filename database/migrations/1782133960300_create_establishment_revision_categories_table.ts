import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'establishment_revision_categories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('revision_id').unsigned().notNullable()
      table.integer('category_id').unsigned().notNullable()
      table.boolean('is_primary').notNullable().defaultTo(false)
      table.integer('sort_order').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['revision_id', 'category_id'],
        'establishment_revision_categories_revision_category_unique'
      )
      table.index(
        ['tenant_id', 'revision_id', 'is_primary', 'sort_order'],
        'establishment_revision_categories_revision_index'
      )
      table
        .foreign(
          ['revision_id', 'tenant_id'],
          'establishment_revision_categories_revision_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishment_revisions')
        .onDelete('CASCADE')
      table
        .foreign(
          ['category_id', 'tenant_id'],
          'establishment_revision_categories_category_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('categories')
        .onDelete('RESTRICT')

      table.check('sort_order >= 0', [], 'establishment_revision_categories_sort_order_check')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        `CREATE UNIQUE INDEX establishment_revision_categories_primary_unique
         ON establishment_revision_categories (revision_id)
         WHERE is_primary = true`
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
