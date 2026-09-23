import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The history of partner content — ADR-0028 §4.
 *
 * The ADR defines editing as a change in place "com histórico append-only de
 * quem alterou o quê e quando, no padrão de eventos do ADR-0015". The content
 * tables keep only the current state and the archive author, so until now an
 * edit left no trace of what it replaced, and nobody could say who changed a
 * published event's date.
 *
 * One table for the three kinds, keyed by kind and id, because the lifecycle is
 * one and the same for all of them. There is no foreign key to the content row
 * for that reason; the establishment and the tenant are enforced instead, which
 * is what scopes every read.
 *
 * `changes` holds only the fields that moved, as `{ field: { from, to } }`,
 * never a copy of the row: identifiers, the tenant and the lifecycle columns do
 * not belong in an audit payload that is read on a screen.
 */
export default class extends BaseSchema {
  protected tableName = 'partner_content_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.string('content_kind', 24).notNullable()
      table.integer('content_id').unsigned().notNullable()
      table.string('action', 24).notNullable()
      table.string('from_status', 24).nullable()
      table.string('to_status', 24).nullable()
      // Moderators are global users (ADR-0007), so the actor is a user, not a
      // membership.
      table.integer('actor_id').unsigned().notNullable()
      table.jsonb('changes').nullable()
      table.jsonb('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table
        .foreign('tenant_id', 'partner_content_events_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['establishment_id', 'tenant_id'], 'partner_content_events_establishment_foreign')
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('RESTRICT')
      table
        .foreign('actor_id', 'partner_content_events_actor_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.index(
        ['tenant_id', 'content_kind', 'content_id', 'created_at'],
        'partner_content_events_content_index'
      )
      table.index(['actor_id', 'created_at'], 'partner_content_events_actor_index')

      table.check(
        "content_kind IN ('experience', 'event', 'showcase_item')",
        [],
        'partner_content_events_kind_check'
      )
      table.check(
        `action IN (
          'created', 'updated', 'submitted', 'approved', 'rejected', 'archived', 'admin_edited'
        )`,
        [],
        'partner_content_events_action_check'
      )
      table.check(
        "changes IS NULL OR jsonb_typeof(changes) = 'object'",
        [],
        'partner_content_events_changes_object_check'
      )
      table.check(
        "metadata IS NULL OR jsonb_typeof(metadata) = 'object'",
        [],
        'partner_content_events_metadata_object_check'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION prevent_partner_content_event_mutation()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RAISE EXCEPTION 'partner_content_events is append-only';
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE TRIGGER partner_content_events_immutable_trigger
        BEFORE UPDATE OR DELETE ON partner_content_events
        FOR EACH ROW
        EXECUTE FUNCTION prevent_partner_content_event_mutation()
      `)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.defer(async (db) => {
      await db.rawQuery('DROP FUNCTION IF EXISTS prevent_partner_content_event_mutation()')
    })
  }
}
