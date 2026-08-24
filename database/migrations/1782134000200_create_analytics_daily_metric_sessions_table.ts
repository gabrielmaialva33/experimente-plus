import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'analytics_daily_metric_sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.date('metric_date').notNullable()
      table.string('event_type', 40).notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.string('source', 16).notNullable()
      table.string('anonymous_session_hash', 64).notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        [
          'tenant_id',
          'metric_date',
          'event_type',
          'establishment_id',
          'source',
          'anonymous_session_hash',
        ],
        'analytics_daily_metric_sessions_dimension_unique'
      )
      table.index(['expires_at'], 'analytics_daily_metric_sessions_expires_at_index')
      table.index(
        ['tenant_id', 'establishment_id', 'metric_date'],
        'analytics_daily_metric_sessions_establishment_date_index'
      )

      table
        .foreign('tenant_id', 'analytics_daily_metric_sessions_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(
          ['establishment_id', 'tenant_id'],
          'analytics_daily_metric_sessions_establishment_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('CASCADE')

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
        'analytics_daily_metric_sessions_type_check'
      )
      table.check(
        "source IN ('web', 'redirect', 'server')",
        [],
        'analytics_daily_metric_sessions_source_check'
      )
      table.check(
        "anonymous_session_hash ~ '^[0-9a-f]{64}$'",
        [],
        'analytics_daily_metric_sessions_hash_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
