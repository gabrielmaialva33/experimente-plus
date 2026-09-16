import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'establishment_showcase_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('created_by').unsigned().notNullable()
      table.string('title', 180).notNullable()
      table.text('description').nullable()
      table.string('status', 24).notNullable().defaultTo('draft')
      // Display-only amount in cents; deliberately unrelated to benefit offers or purchases.
      table.integer('informational_price_cents').unsigned().nullable()
      // Authoritative approved content is retained while an in-place edit awaits review.
      // Publication, audit events and projection invalidation belong to the next service slice.
      table.jsonb('published_snapshot').nullable()
      table.timestamp('published_at', { useTz: true }).nullable()
      table.integer('archived_by').unsigned().nullable()
      table.timestamp('archived_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'establishment_showcase_items_id_tenant_unique')
      table
        .foreign('tenant_id', 'establishment_showcase_items_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['establishment_id', 'tenant_id'],
          'establishment_showcase_items_establishment_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('RESTRICT')
      table
        .foreign(['created_by', 'tenant_id'], 'establishment_showcase_items_creator_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('RESTRICT')
      // Administrators are global users; archiving does not require tenant membership.
      table
        .foreign('archived_by', 'establishment_showcase_items_archiver_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.index(
        ['tenant_id', 'establishment_id', 'status'],
        'establishment_showcase_items_establishment_status_index'
      )
      table.index(
        ['tenant_id', 'status', 'created_at'],
        'establishment_showcase_items_moderation_index'
      )
      table.check(
        "status IN ('draft', 'pending_review', 'published', 'archived')",
        [],
        'establishment_showcase_items_status_check'
      )
      table.check(
        "published_snapshot IS NULL OR jsonb_typeof(published_snapshot) = 'object'",
        [],
        'establishment_showcase_items_snapshot_object_check'
      )
      table.check(
        '(published_snapshot IS NULL) = (published_at IS NULL)',
        [],
        'establishment_showcase_items_publication_pair_check'
      )
      table.check(
        "status <> 'published' OR published_snapshot IS NOT NULL",
        [],
        'establishment_showcase_items_published_snapshot_check'
      )
      table.check(
        `(status = 'archived' AND archived_at IS NOT NULL AND archived_by IS NOT NULL)
        OR (status <> 'archived' AND archived_at IS NULL AND archived_by IS NULL)`,
        [],
        'establishment_showcase_items_archive_check'
      )
      table.check('informational_price_cents >= 0', [], 'establishment_showcase_items_price_check')
    })

    this.schema.raw(`
      CREATE FUNCTION prevent_establishment_showcase_items_deletion()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Partner content must be archived, never deleted' USING ERRCODE = '23514';
      END;
      $$;
      CREATE TRIGGER establishment_showcase_items_prevent_delete
      BEFORE DELETE ON establishment_showcase_items
      FOR EACH ROW EXECUTE FUNCTION prevent_establishment_showcase_items_deletion();
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP FUNCTION IF EXISTS prevent_establishment_showcase_items_deletion()')
  }
}
