import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'analytics_daily_metrics'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.date('metric_date').notNullable()
      table.string('event_type', 40).notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('city_id').unsigned().notNullable()
      table.string('source', 16).notNullable()
      table.bigInteger('event_count').unsigned().notNullable().defaultTo(0)
      table.bigInteger('unique_sessions').unsigned().notNullable().defaultTo(0)
      table.timestamp('first_event_at', { useTz: true }).notNullable()
      table.timestamp('last_event_at', { useTz: true }).notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['tenant_id', 'metric_date', 'event_type', 'establishment_id', 'source'],
        'analytics_daily_metrics_dimension_unique'
      )
      table.index(
        ['tenant_id', 'establishment_id', 'metric_date'],
        'analytics_daily_metrics_establishment_date_index'
      )
      table.index(
        ['tenant_id', 'city_id', 'metric_date'],
        'analytics_daily_metrics_city_date_index'
      )
      table.index(['expires_at'], 'analytics_daily_metrics_expires_at_index')

      table
        .foreign('tenant_id', 'analytics_daily_metrics_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(
          ['establishment_id', 'tenant_id'],
          'analytics_daily_metrics_establishment_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('CASCADE')
      table
        .foreign(['city_id', 'tenant_id'], 'analytics_daily_metrics_city_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('cities')
        .onDelete('RESTRICT')

      table.check(
        `event_type IN (
          'catalog_impression',
          'establishment_view',
          'route_click',
          'whatsapp_click',
          'phone_click',
          'website_click',
          'share_click'
        )`,
        [],
        'analytics_daily_metrics_type_check'
      )
      table.check(
        "source IN ('web', 'redirect', 'server')",
        [],
        'analytics_daily_metrics_source_check'
      )
      table.check(
        'event_count >= 0 AND unique_sessions >= 0 AND unique_sessions <= event_count',
        [],
        'analytics_daily_metrics_counts_check'
      )
      table.check(
        'last_event_at >= first_event_at AND expires_at > last_event_at',
        [],
        'analytics_daily_metrics_timestamps_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
