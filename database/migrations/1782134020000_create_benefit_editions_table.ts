import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'benefit_editions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('city_id').unsigned().notNullable()
      table.string('name', 160).notNullable()
      table.string('slug', 180).notNullable()
      table.text('description').nullable()
      table.integer('price_cents').unsigned().notNullable().defaultTo(0)
      table.string('currency', 3).notNullable().defaultTo('BRL')
      table.timestamp('sales_starts_at', { useTz: true }).nullable()
      table.timestamp('sales_ends_at', { useTz: true }).nullable()
      table.timestamp('usage_starts_at', { useTz: true }).notNullable()
      table.timestamp('usage_ends_at', { useTz: true }).notNullable()
      table.string('status', 24).notNullable().defaultTo('draft')
      table.integer('created_by').unsigned().nullable()
      table.timestamp('published_at', { useTz: true }).nullable()
      table.timestamp('archived_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'slug'], 'benefit_editions_tenant_slug_unique')
      table.unique(['id', 'tenant_id'], 'benefit_editions_id_tenant_unique')

      table
        .foreign('tenant_id', 'benefit_editions_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['city_id', 'tenant_id'], 'benefit_editions_city_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('cities')
        .onDelete('RESTRICT')
      table
        .foreign('created_by', 'benefit_editions_created_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.index(
        ['tenant_id', 'city_id', 'status', 'usage_ends_at'],
        'benefit_editions_operation_index'
      )

      table.check('price_cents >= 0', [], 'benefit_editions_price_check')
      table.check("currency ~ '^[A-Z]{3}$'", [], 'benefit_editions_currency_check')
      table.check(
        "status IN ('draft', 'published', 'paused', 'archived')",
        [],
        'benefit_editions_status_check'
      )
      table.check('usage_ends_at > usage_starts_at', [], 'benefit_editions_usage_window_check')
      table.check(
        `(
          sales_starts_at IS NULL AND sales_ends_at IS NULL
        ) OR (
          sales_starts_at IS NOT NULL
          AND sales_ends_at IS NOT NULL
          AND sales_ends_at > sales_starts_at
        )`,
        [],
        'benefit_editions_sales_window_check'
      )
      table.check(
        `(
          status = 'draft'
          AND published_at IS NULL
          AND archived_at IS NULL
        ) OR (
          status IN ('published', 'paused')
          AND published_at IS NOT NULL
          AND archived_at IS NULL
        ) OR (
          status = 'archived'
          AND archived_at IS NOT NULL
        )`,
        [],
        'benefit_editions_state_timestamps_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
