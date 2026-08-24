import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'analytics_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.uuid('event_id').notNullable()
      table.string('event_type', 40).notNullable()
      table.integer('establishment_id').unsigned().nullable()
      table.integer('published_revision_id').unsigned().nullable()
      table.integer('city_id').unsigned().notNullable()
      table.date('metric_date').notNullable()
      table.string('anonymous_session_hash', 64).notNullable()
      table.string('dedupe_key', 64).notNullable()
      table.string('source', 16).notNullable().defaultTo('web')
      table.string('search_term_redacted', 120).nullable()
      table.string('search_term_hash', 64).nullable()
      table.string('category_slug', 180).nullable()
      table.jsonb('metadata').nullable()
      table.timestamp('occurred_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'event_id'], 'analytics_events_tenant_event_unique')
      table.unique(['tenant_id', 'dedupe_key'], 'analytics_events_tenant_dedupe_unique')
      table.index(
        ['tenant_id', 'establishment_id', 'metric_date', 'event_type'],
        'analytics_events_establishment_date_index'
      )
      table.index(
        ['tenant_id', 'city_id', 'metric_date', 'event_type'],
        'analytics_events_city_date_index'
      )
      table.index(['expires_at'], 'analytics_events_expires_at_index')
      table.index(
        ['tenant_id', 'search_term_hash', 'metric_date'],
        'analytics_events_search_term_index'
      )

      table
        .foreign('tenant_id', 'analytics_events_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['city_id', 'tenant_id'], 'analytics_events_city_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('cities')
        .onDelete('RESTRICT')
      table
        .foreign(['establishment_id', 'tenant_id'], 'analytics_events_establishment_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('CASCADE')
      table
        .foreign(
          ['published_revision_id', 'tenant_id', 'establishment_id'],
          'analytics_events_revision_tenant_establishment_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_revisions')
        .onDelete('CASCADE')

      table.check(
        `event_type IN (
          'catalog_impression',
          'establishment_view',
          'route_click',
          'whatsapp_click',
          'phone_click',
          'website_click',
          'share_click',
          'search_without_results'
        )`,
        [],
        'analytics_events_type_check'
      )
      table.check("source IN ('web', 'redirect', 'server')", [], 'analytics_events_source_check')
      table.check(
        "anonymous_session_hash ~ '^[0-9a-f]{64}$' AND dedupe_key ~ '^[0-9a-f]{64}$'",
        [],
        'analytics_events_hashes_check'
      )
      table.check(
        "search_term_hash IS NULL OR search_term_hash ~ '^[0-9a-f]{64}$'",
        [],
        'analytics_events_search_hash_check'
      )
      table.check(
        `(
          event_type = 'search_without_results'
          AND establishment_id IS NULL
          AND published_revision_id IS NULL
          AND search_term_redacted IS NOT NULL
          AND search_term_hash IS NOT NULL
        ) OR (
          event_type <> 'search_without_results'
          AND establishment_id IS NOT NULL
          AND published_revision_id IS NOT NULL
          AND search_term_redacted IS NULL
          AND search_term_hash IS NULL
        )`,
        [],
        'analytics_events_shape_check'
      )
      table.check(
        'search_term_redacted IS NULL OR char_length(btrim(search_term_redacted)) BETWEEN 1 AND 120',
        [],
        'analytics_events_search_term_length_check'
      )
      table.check(
        "category_slug IS NULL OR category_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'",
        [],
        'analytics_events_category_slug_check'
      )
      table.check(
        'metadata IS NULL OR pg_column_size(metadata) <= 4096',
        [],
        'analytics_events_metadata_size_check'
      )
      table.check('expires_at > occurred_at', [], 'analytics_events_expiry_check')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE FUNCTION prevent_analytics_event_mutation()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF TG_OP = 'UPDATE' THEN
            RAISE EXCEPTION 'analytics_events is append-only';
          END IF;

          IF TG_OP = 'DELETE' THEN
            IF current_setting('app.analytics_retention', true) = 'on' OR pg_trigger_depth() > 1 THEN
              RETURN OLD;
            END IF;

            RAISE EXCEPTION 'analytics_events may only be deleted by retention';
          END IF;

          RETURN OLD;
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE TRIGGER analytics_events_immutable_trigger
        BEFORE UPDATE OR DELETE ON analytics_events
        FOR EACH ROW
        EXECUTE FUNCTION prevent_analytics_event_mutation()
      `)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.defer(async (db) => {
      await db.rawQuery('DROP FUNCTION IF EXISTS prevent_analytics_event_mutation()')
    })
  }
}
