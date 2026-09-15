import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'establishment_review_replies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('review_id').unsigned().notNullable()
      table.integer('organization_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.text('comment').notNullable()
      table.string('status', 24).notNullable().defaultTo('published')
      table.timestamp('edited_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'establishment_review_replies_id_tenant_unique')
      table.unique(['review_id'], 'establishment_review_replies_review_unique')

      table
        .foreign('tenant_id', 'establishment_review_replies_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['review_id', 'tenant_id'], 'establishment_review_replies_review_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('establishment_reviews')
        .onDelete('CASCADE')
      table
        .foreign(
          ['organization_id', 'tenant_id'],
          'establishment_review_replies_organization_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('organizations')
        .onDelete('RESTRICT')
      table
        .foreign(['user_id', 'tenant_id'], 'establishment_review_replies_user_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('RESTRICT')

      table.index(
        ['tenant_id', 'organization_id', 'created_at'],
        'establishment_review_replies_organization_created_index'
      )
      table.index(
        ['tenant_id', 'status', 'created_at'],
        'establishment_review_replies_status_created_index'
      )

      table.check(
        "NULLIF(btrim(comment), '') IS NOT NULL",
        [],
        'establishment_review_replies_comment_not_empty_check'
      )
      table.check(
        "status IN ('published', 'hidden')",
        [],
        'establishment_review_replies_status_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
