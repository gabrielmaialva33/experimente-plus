import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Itineraries an Explorer saves — ADR-0030, Anexo I item 10.
 *
 * Private to their author. The scope asks for creating and saving a route, not
 * for publishing one, and item 9 sizes the human queue for reviews, replies and
 * partner content. A public itinerary would be a free-text surface that no
 * queue was sized to review, and continuous moderation is explicitly outside
 * the contracted delivery.
 */
export default class extends BaseSchema {
  protected tableName = 'explorer_itineraries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.string('name', 120).notNullable()
      table.text('notes').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'explorer_itineraries_id_tenant_unique')

      table
        .foreign('tenant_id', 'explorer_itineraries_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['user_id', 'tenant_id'], 'explorer_itineraries_user_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('CASCADE')

      table.index(['tenant_id', 'user_id', 'updated_at'], 'explorer_itineraries_owner_index')
      table.check("btrim(name) <> ''", [], 'explorer_itineraries_name_not_blank_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
