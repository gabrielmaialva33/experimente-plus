import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'analytics_daily_search_sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.date('metric_date').notNullable()
      table.integer('city_id').unsigned().notNullable()
      table.string('search_term_hash', 64).notNullable()
      table.string('category_key', 180).notNullable().defaultTo('')
      table.string('anonymous_session_hash', 64).notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        [
          'tenant_id',
          'metric_date',
          'city_id',
          'search_term_hash',
          'category_key',
          'anonymous_session_hash',
        ],
        'analytics_daily_search_sessions_dimension_unique'
      )
      table.index(['expires_at'], 'analytics_daily_search_sessions_expires_at_index')
      table.index(
        ['tenant_id', 'city_id', 'metric_date'],
        'analytics_daily_search_sessions_city_date_index'
      )

      table
        .foreign('tenant_id', 'analytics_daily_search_sessions_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['city_id', 'tenant_id'], 'analytics_daily_search_sessions_city_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('cities')
        .onDelete('RESTRICT')

      table.check(
        "search_term_hash ~ '^[0-9a-f]{64}$' AND anonymous_session_hash ~ '^[0-9a-f]{64}$'",
        [],
        'analytics_daily_search_sessions_hashes_check'
      )
      table.check(
        "category_key = '' OR category_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'",
        [],
        'analytics_daily_search_sessions_category_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
