import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'partner_content_media'

  async up() {
    // Forward-only relational anchors for a media assignment. The original
    // partner-content migrations are already published, so their history stays
    // immutable and these composite keys are added here.
    this.schema.alterTable('establishment_experiences', (table) => {
      table.unique(
        ['id', 'tenant_id', 'establishment_id'],
        'establishment_experiences_id_tenant_establishment_unique'
      )
    })
    this.schema.alterTable('establishment_events', (table) => {
      table.unique(
        ['id', 'tenant_id', 'establishment_id'],
        'establishment_events_id_tenant_establishment_unique'
      )
    })
    this.schema.alterTable('establishment_showcase_items', (table) => {
      table.unique(
        ['id', 'tenant_id', 'establishment_id'],
        'establishment_showcase_items_id_tenant_establishment_unique'
      )
    })

    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('experience_id').unsigned().nullable()
      table.integer('event_id').unsigned().nullable()
      table.integer('showcase_item_id').unsigned().nullable()
      table.integer('media_asset_id').unsigned().notNullable()
      table.boolean('is_cover').notNullable().defaultTo(false)
      table.integer('sort_order').notNullable().defaultTo(0)
      table.string('alt_text', 180).notNullable()
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
        'partner_content_media_id_tenant_establishment_unique'
      )
      table.unique(
        ['tenant_id', 'experience_id', 'sort_order'],
        'partner_content_media_experience_order_unique'
      )
      table.unique(
        ['tenant_id', 'event_id', 'sort_order'],
        'partner_content_media_event_order_unique'
      )
      table.unique(
        ['tenant_id', 'showcase_item_id', 'sort_order'],
        'partner_content_media_showcase_order_unique'
      )

      table.index(
        ['tenant_id', 'establishment_id', 'moderation_status', 'created_at'],
        'partner_content_media_moderation_index'
      )
      table.index(['media_asset_id'], 'partner_content_media_asset_index')
      table.index(['tenant_id', 'experience_id'], 'partner_content_media_experience_index')
      table.index(['tenant_id', 'event_id'], 'partner_content_media_event_index')
      table.index(['tenant_id', 'showcase_item_id'], 'partner_content_media_showcase_index')

      table
        .foreign('tenant_id', 'partner_content_media_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(
          ['media_asset_id', 'tenant_id', 'establishment_id'],
          'partner_content_media_asset_tenant_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('media_assets')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['experience_id', 'tenant_id', 'establishment_id'],
          'partner_content_media_experience_tenant_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_experiences')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['event_id', 'tenant_id', 'establishment_id'],
          'partner_content_media_event_tenant_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_events')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['showcase_item_id', 'tenant_id', 'establishment_id'],
          'partner_content_media_showcase_tenant_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_showcase_items')
        .onDelete('RESTRICT')
      table
        .foreign('created_by', 'partner_content_media_created_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .foreign('reviewed_by', 'partner_content_media_reviewed_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.check(
        '((experience_id IS NOT NULL)::integer + (event_id IS NOT NULL)::integer + (showcase_item_id IS NOT NULL)::integer) = 1',
        [],
        'partner_content_media_one_target_check'
      )
      table.check(
        "moderation_status IN ('pending', 'approved', 'rejected', 'quarantined')",
        [],
        'partner_content_media_status_check'
      )
      table.check('sort_order >= 0', [], 'partner_content_media_sort_order_check')
      table.check(
        'char_length(btrim(alt_text)) BETWEEN 1 AND 180',
        [],
        'partner_content_media_alt_text_check'
      )
      table.check(
        'caption IS NULL OR char_length(btrim(caption)) BETWEEN 1 AND 500',
        [],
        'partner_content_media_caption_check'
      )
      table.check(
        "((moderation_status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_notes IS NULL) OR (moderation_status = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR (moderation_status IN ('rejected', 'quarantined') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND NULLIF(btrim(review_notes), '') IS NOT NULL AND is_cover = false))",
        [],
        'partner_content_media_review_state_check'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'CREATE UNIQUE INDEX partner_content_media_experience_cover_index ON partner_content_media (tenant_id, experience_id) WHERE experience_id IS NOT NULL AND is_cover = true'
      )
      await db.rawQuery(
        'CREATE UNIQUE INDEX partner_content_media_event_cover_index ON partner_content_media (tenant_id, event_id) WHERE event_id IS NOT NULL AND is_cover = true'
      )
      await db.rawQuery(
        'CREATE UNIQUE INDEX partner_content_media_showcase_cover_index ON partner_content_media (tenant_id, showcase_item_id) WHERE showcase_item_id IS NOT NULL AND is_cover = true'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)

    this.schema.alterTable('establishment_showcase_items', (table) => {
      table.dropUnique(
        ['id', 'tenant_id', 'establishment_id'],
        'establishment_showcase_items_id_tenant_establishment_unique'
      )
    })
    this.schema.alterTable('establishment_events', (table) => {
      table.dropUnique(
        ['id', 'tenant_id', 'establishment_id'],
        'establishment_events_id_tenant_establishment_unique'
      )
    })
    this.schema.alterTable('establishment_experiences', (table) => {
      table.dropUnique(
        ['id', 'tenant_id', 'establishment_id'],
        'establishment_experiences_id_tenant_establishment_unique'
      )
    })
  }
}
