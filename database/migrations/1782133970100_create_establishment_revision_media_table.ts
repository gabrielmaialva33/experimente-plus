import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'establishment_revision_media'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('revision_id').unsigned().notNullable()
      table.integer('media_asset_id').unsigned().notNullable()
      table.string('purpose', 24).notNullable().defaultTo('gallery')
      table.boolean('is_cover').notNullable().defaultTo(false)
      table.integer('sort_order').notNullable().defaultTo(0)
      table.string('alt_text', 180).nullable()
      table.string('caption', 500).nullable()
      table.string('moderation_status', 24).notNullable().defaultTo('pending')
      table.integer('created_by').unsigned().nullable()
      table.integer('reviewed_by').unsigned().nullable()
      table.timestamp('reviewed_at', { useTz: true }).nullable()
      table.text('review_notes').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['id', 'tenant_id', 'establishment_id'],
        'establishment_revision_media_id_tenant_establishment_unique'
      )
      table.unique(
        ['revision_id', 'media_asset_id'],
        'establishment_revision_media_revision_asset_unique'
      )
      table.unique(
        ['revision_id', 'sort_order'],
        'establishment_revision_media_revision_order_unique'
      )
      table.index(
        ['tenant_id', 'establishment_id', 'revision_id', 'moderation_status'],
        'establishment_revision_media_revision_status_index'
      )
      table.index(
        ['tenant_id', 'moderation_status', 'created_at'],
        'establishment_revision_media_moderation_queue_index'
      )
      table.index(['media_asset_id'], 'establishment_revision_media_asset_index')

      table
        .foreign('tenant_id', 'establishment_revision_media_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(
          ['revision_id', 'tenant_id', 'establishment_id'],
          'establishment_revision_media_revision_tenant_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_revisions')
        .onDelete('CASCADE')
      table
        .foreign(
          ['media_asset_id', 'tenant_id', 'establishment_id'],
          'establishment_revision_media_asset_tenant_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('media_assets')
        .onDelete('RESTRICT')
      table
        .foreign('created_by', 'establishment_revision_media_created_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .foreign('reviewed_by', 'establishment_revision_media_reviewed_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.check(
        "purpose IN ('gallery', 'logo', 'menu', 'interior', 'exterior', 'product', 'team', 'service')",
        [],
        'establishment_revision_media_purpose_check'
      )
      table.check(
        "moderation_status IN ('pending', 'approved', 'rejected', 'quarantined')",
        [],
        'establishment_revision_media_status_check'
      )
      table.check('sort_order >= 0', [], 'establishment_revision_media_sort_order_check')
      table.check(
        'alt_text IS NULL OR char_length(btrim(alt_text)) BETWEEN 1 AND 180',
        [],
        'establishment_revision_media_alt_text_check'
      )
      table.check(
        'caption IS NULL OR char_length(btrim(caption)) BETWEEN 1 AND 500',
        [],
        'establishment_revision_media_caption_check'
      )
      table.check(
        `(
          moderation_status = 'pending'
          AND reviewed_by IS NULL
          AND reviewed_at IS NULL
          AND review_notes IS NULL
        ) OR (
          moderation_status = 'approved'
          AND reviewed_by IS NOT NULL
          AND reviewed_at IS NOT NULL
          AND NULLIF(btrim(alt_text), '') IS NOT NULL
        ) OR (
          moderation_status IN ('rejected', 'quarantined')
          AND reviewed_by IS NOT NULL
          AND reviewed_at IS NOT NULL
          AND NULLIF(btrim(review_notes), '') IS NOT NULL
          AND is_cover = false
        )`,
        [],
        'establishment_revision_media_review_state_check'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE UNIQUE INDEX establishment_revision_media_one_cover_index
        ON establishment_revision_media (tenant_id, revision_id)
        WHERE is_cover = true
      `)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
