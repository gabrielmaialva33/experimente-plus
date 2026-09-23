import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Photos attached to an Explorer's review — ADR-0027, Anexo I item 8.
 *
 * They reuse `files` and `media_assets` (ADR-0014) instead of a second media
 * pipeline, and they carry no moderation state of their own: a photo is part
 * of the review it belongs to and is public exactly when that review is. That
 * choice, and why it differs from establishment and partner-content media, is
 * recorded in ADR-0027.
 *
 * The composite keys tie each photo to the review *and* to the establishment
 * of its asset, so a photo can never point at an asset of another place or
 * another operation — the same guarantee the rest of the media schema gives.
 */
export default class extends BaseSchema {
  protected tableName = 'establishment_review_photos'

  async up() {
    // Forward-only anchor: the reviews table is already published, so the key
    // the photo references is added here rather than edited into its history.
    this.schema.alterTable('establishment_reviews', (table) => {
      table.unique(
        ['id', 'tenant_id', 'establishment_id'],
        'establishment_reviews_id_tenant_establishment_unique'
      )
    })

    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('review_id').unsigned().notNullable()
      table.integer('media_asset_id').unsigned().notNullable()
      table.integer('sort_order').unsigned().notNullable().defaultTo(0)
      table.string('alt_text', 180).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'establishment_review_photos_id_tenant_unique')
      table.unique(
        ['tenant_id', 'review_id', 'sort_order'],
        'establishment_review_photos_review_order_unique'
      )
      // An asset belongs to one photo; sharing it would make deleting one
      // photo remove another person's image.
      table.unique(['media_asset_id'], 'establishment_review_photos_asset_unique')

      table
        .foreign('tenant_id', 'establishment_review_photos_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(
          ['review_id', 'tenant_id', 'establishment_id'],
          'establishment_review_photos_review_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_reviews')
        .onDelete('CASCADE')
      table
        .foreign(
          ['media_asset_id', 'tenant_id', 'establishment_id'],
          'establishment_review_photos_asset_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('media_assets')
        .onDelete('RESTRICT')

      table.index(['tenant_id', 'review_id'], 'establishment_review_photos_review_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.alterTable('establishment_reviews', (table) => {
      table.dropUnique(
        ['id', 'tenant_id', 'establishment_id'],
        'establishment_reviews_id_tenant_establishment_unique'
      )
    })
  }
}
