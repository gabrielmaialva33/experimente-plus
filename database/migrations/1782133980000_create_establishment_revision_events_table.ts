import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'establishment_revision_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('revision_id').unsigned().notNullable()
      table.string('event_type', 32).notNullable()
      table.string('from_status', 32).nullable()
      table.string('to_status', 32).notNullable()
      table.integer('actor_id').unsigned().notNullable()
      table.text('reason').nullable()
      table.jsonb('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['id', 'tenant_id', 'establishment_id', 'revision_id'],
        'establishment_revision_events_identity_unique'
      )
      table.index(
        ['tenant_id', 'establishment_id', 'revision_id', 'created_at'],
        'establishment_revision_events_revision_index'
      )
      table.index(
        ['tenant_id', 'event_type', 'created_at'],
        'establishment_revision_events_type_index'
      )
      table.index(['actor_id', 'created_at'], 'establishment_revision_events_actor_index')

      table
        .foreign('tenant_id', 'establishment_revision_events_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(
          ['revision_id', 'tenant_id', 'establishment_id'],
          'establishment_revision_events_revision_tenant_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_revisions')
        .onDelete('CASCADE')
      table
        .foreign('actor_id', 'establishment_revision_events_actor_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.check(
        "event_type IN ('created', 'submitted', 'changes_requested', 'resubmitted', 'approved', 'rejected', 'published', 'draft_cloned')",
        [],
        'establishment_revision_events_type_check'
      )
      table.check(
        "from_status IS NULL OR from_status IN ('draft', 'pending_review', 'changes_requested', 'approved', 'rejected')",
        [],
        'establishment_revision_events_from_status_check'
      )
      table.check(
        "to_status IN ('draft', 'pending_review', 'changes_requested', 'approved', 'rejected')",
        [],
        'establishment_revision_events_to_status_check'
      )
      table.check(
        "event_type NOT IN ('changes_requested', 'rejected') OR NULLIF(btrim(reason), '') IS NOT NULL",
        [],
        'establishment_revision_events_reason_check'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE FUNCTION prevent_establishment_revision_event_mutation()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RAISE EXCEPTION 'establishment_revision_events is append-only';
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE TRIGGER establishment_revision_events_immutable_trigger
        BEFORE UPDATE OR DELETE ON establishment_revision_events
        FOR EACH ROW
        EXECUTE FUNCTION prevent_establishment_revision_event_mutation()
      `)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.defer(async (db) => {
      await db.rawQuery('DROP FUNCTION IF EXISTS prevent_establishment_revision_event_mutation()')
    })
  }
}
