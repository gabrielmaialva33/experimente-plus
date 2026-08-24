import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'establishment_revisions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('version').unsigned().notNullable()
      table.string('status', 32).notNullable().defaultTo('draft')
      table.integer('city_id').unsigned().nullable()

      table.string('public_name', 160).nullable()
      table.string('slug', 180).nullable()
      table.string('short_description', 320).nullable()
      table.text('description').nullable()

      table.string('public_phone', 32).nullable()
      table.string('whatsapp', 32).nullable()
      table.string('public_email', 254).nullable()
      table.string('website', 2048).nullable()
      table.string('instagram', 160).nullable()
      table.string('booking_url', 2048).nullable()
      table.string('availability_type', 32).notNullable().defaultTo('regular_hours')

      table.integer('based_on_revision_id').unsigned().nullable()
      table.integer('created_by').unsigned().nullable()
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table.integer('reviewed_by').unsigned().nullable()
      table.timestamp('reviewed_at', { useTz: true }).nullable()
      table.text('review_notes').nullable()
      table.integer('rules_version').unsigned().notNullable().defaultTo(2)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['establishment_id', 'version'],
        'establishment_revisions_establishment_version_unique'
      )
      table.unique(['id', 'tenant_id'], 'establishment_revisions_id_tenant_unique')
      table.unique(
        ['id', 'tenant_id', 'establishment_id'],
        'establishment_revisions_id_tenant_establishment_unique'
      )

      table
        .foreign('tenant_id', 'establishment_revisions_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      table
        .foreign(
          ['establishment_id', 'tenant_id'],
          'establishment_revisions_establishment_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('CASCADE')

      table
        .foreign(['city_id', 'tenant_id'], 'establishment_revisions_city_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('cities')
        .onDelete('RESTRICT')

      table
        .foreign(
          ['based_on_revision_id', 'tenant_id', 'establishment_id'],
          'establishment_revisions_base_tenant_establishment_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_revisions')
        .onDelete('RESTRICT')

      table
        .foreign('created_by', 'establishment_revisions_created_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table
        .foreign('reviewed_by', 'establishment_revisions_reviewed_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.index(
        ['tenant_id', 'establishment_id', 'status', 'version'],
        'establishment_revisions_establishment_status_index'
      )
      table.index(['tenant_id', 'city_id', 'slug'], 'establishment_revisions_city_slug_index')
      table.index(
        ['tenant_id', 'status', 'submitted_at'],
        'establishment_revisions_review_queue_index'
      )

      table.check(
        "status IN ('draft', 'pending_review', 'changes_requested', 'approved', 'rejected')",
        [],
        'establishment_revisions_status_check'
      )
      table.check(
        "availability_type IN ('regular_hours', 'appointment_only', 'always_open')",
        [],
        'establishment_revisions_availability_type_check'
      )
      table.check('version > 0', [], 'establishment_revisions_version_check')
      table.check('rules_version > 0', [], 'establishment_revisions_rules_version_check')
      table.check(
        "public_name IS NULL OR btrim(public_name) <> ''",
        [],
        'establishment_revisions_public_name_check'
      )
      table.check(
        "slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'",
        [],
        'establishment_revisions_slug_check'
      )
      table.check(
        'public_email IS NULL OR public_email = lower(public_email)',
        [],
        'establishment_revisions_public_email_lowercase_check'
      )
      table.check(
        `(
          status = 'draft'
          AND submitted_at IS NULL
          AND reviewed_by IS NULL
          AND reviewed_at IS NULL
        ) OR (
          status = 'pending_review'
          AND submitted_at IS NOT NULL
          AND reviewed_by IS NULL
          AND reviewed_at IS NULL
        ) OR (
          status IN ('changes_requested', 'approved', 'rejected')
          AND submitted_at IS NOT NULL
          AND reviewed_by IS NOT NULL
          AND reviewed_at IS NOT NULL
        )`,
        [],
        'establishment_revisions_review_state_check'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE UNIQUE INDEX establishment_revisions_open_establishment_unique
          ON establishment_revisions (establishment_id)
          WHERE status IN ('draft', 'pending_review', 'changes_requested')
      `)
    })

    this.schema.alterTable('establishments', (table) => {
      table
        .foreign(
          ['published_revision_id', 'tenant_id', 'id'],
          'establishments_published_revision_tenant_establishment_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_revisions')
        .onDelete('RESTRICT')
    })
  }

  async down() {
    this.schema.alterTable('establishments', (table) => {
      table.dropForeign(
        ['published_revision_id', 'tenant_id', 'id'],
        'establishments_published_revision_tenant_establishment_foreign'
      )
    })

    this.schema.dropTable(this.tableName)
  }
}
