import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'establishment_reviews'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.integer('redemption_id').unsigned().nullable()
      table.integer('rating').unsigned().notNullable()
      table.text('comment').nullable()
      table.string('status', 24).notNullable().defaultTo('published')
      table.integer('photos_count').unsigned().notNullable().defaultTo(0)
      table.integer('videos_count').unsigned().notNullable().defaultTo(0)
      table.timestamp('edited_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'establishment_reviews_id_tenant_unique')
      table.unique(
        ['tenant_id', 'establishment_id', 'user_id'],
        'establishment_reviews_user_establishment_unique'
      )

      table
        .foreign('tenant_id', 'establishment_reviews_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(
          ['establishment_id', 'tenant_id'],
          'establishment_reviews_establishment_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('RESTRICT')
      table
        .foreign(['user_id', 'tenant_id'], 'establishment_reviews_user_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('RESTRICT')
      table
        .foreign(['redemption_id', 'tenant_id'], 'establishment_reviews_redemption_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('benefit_redemptions')
        .onDelete('SET NULL')

      table.index(
        ['tenant_id', 'establishment_id', 'status', 'created_at'],
        'establishment_reviews_establishment_status_index'
      )
      table.index(['tenant_id', 'user_id', 'created_at'], 'establishment_reviews_user_created_index')
      table.index(
        ['tenant_id', 'status', 'created_at'],
        'establishment_reviews_status_created_index'
      )

      table.check('rating BETWEEN 1 AND 5', [], 'establishment_reviews_rating_check')
      table.check(
        "status IN ('published', 'hidden', 'archived')",
        [],
        'establishment_reviews_status_check'
      )
      table.check('photos_count >= 0', [], 'establishment_reviews_photos_count_check')
      table.check('videos_count >= 0', [], 'establishment_reviews_videos_count_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
