import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'media_moderation_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('revision_id').unsigned().notNullable()
      table.integer('media_asset_id').unsigned().notNullable()
      table.integer('revision_media_id').unsigned().notNullable()
      table.string('from_status', 24).nullable()
      table.string('to_status', 24).notNullable()
      table.integer('actor_id').unsigned().notNullable()
      table.text('reason').nullable()
      table.jsonb('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(
        ['tenant_id', 'establishment_id', 'revision_id', 'created_at'],
        'media_moderation_events_revision_index'
      )
      table.index(
        ['tenant_id', 'revision_media_id', 'created_at'],
        'media_moderation_events_media_index'
      )
      table.index(['actor_id', 'created_at'], 'media_moderation_events_actor_index')

      table
        .foreign('tenant_id', 'media_moderation_events_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign('actor_id', 'media_moderation_events_actor_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.check(
        "from_status IS NULL OR from_status IN ('pending', 'approved', 'rejected', 'quarantined')",
        [],
        'media_moderation_events_from_status_check'
      )
      table.check(
        "to_status IN ('pending', 'approved', 'rejected', 'quarantined', 'removed')",
        [],
        'media_moderation_events_to_status_check'
      )
      table.check(
        "to_status NOT IN ('rejected', 'quarantined') OR NULLIF(btrim(reason), '') IS NOT NULL",
        [],
        'media_moderation_events_reason_check'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION prevent_media_moderation_event_mutation()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RAISE EXCEPTION 'media_moderation_events is append-only';
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE TRIGGER media_moderation_events_immutable_trigger
        BEFORE UPDATE OR DELETE ON media_moderation_events
        FOR EACH ROW
        EXECUTE FUNCTION prevent_media_moderation_event_mutation()
      `)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.defer(async (db) => {
      await db.rawQuery('DROP FUNCTION IF EXISTS prevent_media_moderation_event_mutation()')
    })
  }
}
