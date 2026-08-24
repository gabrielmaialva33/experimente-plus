import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'media_assets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('file_id').unsigned().notNullable()
      table.string('media_type', 16).notNullable().defaultTo('image')
      table.string('file_extension', 12).notNullable()
      table.string('mime_type', 100).notNullable()
      table.string('checksum_sha256', 64).notNullable()
      table.integer('width').unsigned().notNullable()
      table.integer('height').unsigned().notNullable()
      table.integer('created_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['file_id'], 'media_assets_file_unique')
      table.unique(
        ['id', 'tenant_id', 'establishment_id'],
        'media_assets_id_tenant_establishment_unique'
      )
      table.index(
        ['tenant_id', 'establishment_id', 'created_at'],
        'media_assets_establishment_index'
      )
      table.index(['tenant_id', 'checksum_sha256'], 'media_assets_checksum_index')

      table
        .foreign('tenant_id', 'media_assets_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['file_id', 'tenant_id'], 'media_assets_file_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('files')
        .onDelete('RESTRICT')
      table
        .foreign(['establishment_id', 'tenant_id'], 'media_assets_establishment_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('CASCADE')
      table
        .foreign('created_by', 'media_assets_created_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.check("media_type IN ('image')", [], 'media_assets_media_type_check')
      table.check(
        "file_extension IN ('jpg', 'jpeg', 'png', 'webp')",
        [],
        'media_assets_file_extension_check'
      )
      table.check(
        "mime_type IN ('image/jpeg', 'image/png', 'image/webp')",
        [],
        'media_assets_mime_type_check'
      )
      table.check("checksum_sha256 ~ '^[0-9a-f]{64}$'", [], 'media_assets_checksum_check')
      table.check(
        'width BETWEEN 1 AND 12000 AND height BETWEEN 1 AND 12000',
        [],
        'media_assets_dimensions_check'
      )
      table.check(
        '(width::bigint * height::bigint) <= 60000000',
        [],
        'media_assets_pixel_area_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
