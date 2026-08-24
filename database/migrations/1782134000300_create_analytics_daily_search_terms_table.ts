import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'analytics_daily_search_terms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.date('metric_date').notNullable()
      table.integer('city_id').unsigned().notNullable()
      table.string('search_term_hash', 64).notNullable()
      table.string('search_term_redacted', 120).notNullable()
      table.string('category_slug', 180).nullable()
      table.string('category_key', 180).notNullable().defaultTo('')
      table.bigInteger('event_count').unsigned().notNullable().defaultTo(0)
      table.bigInteger('unique_sessions').unsigned().notNullable().defaultTo(0)
      table.timestamp('first_event_at', { useTz: true }).notNullable()
      table.timestamp('last_event_at', { useTz: true }).notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['tenant_id', 'metric_date', 'city_id', 'search_term_hash', 'category_key'],
        'analytics_daily_search_terms_dimension_unique'
      )
      table.index(
        ['tenant_id', 'metric_date', 'event_count'],
        'analytics_daily_search_terms_date_count_index'
      )
      table.index(['expires_at'], 'analytics_daily_search_terms_expires_at_index')

      table
        .foreign('tenant_id', 'analytics_daily_search_terms_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['city_id', 'tenant_id'], 'analytics_daily_search_terms_city_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('cities')
        .onDelete('RESTRICT')

      table.check(
        "search_term_hash ~ '^[0-9a-f]{64}$'",
        [],
        'analytics_daily_search_terms_hash_check'
      )
      table.check(
        'char_length(btrim(search_term_redacted)) BETWEEN 1 AND 120',
        [],
        'analytics_daily_search_terms_text_check'
      )
      table.check(
        "(category_slug IS NULL AND category_key = '') OR (category_slug = category_key AND category_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')",
        [],
        'analytics_daily_search_terms_category_check'
      )
      table.check(
        'event_count >= 0 AND unique_sessions >= 0 AND unique_sessions <= event_count',
        [],
        'analytics_daily_search_terms_counts_check'
      )
      table.check(
        'last_event_at >= first_event_at AND expires_at > last_event_at',
        [],
        'analytics_daily_search_terms_timestamps_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
