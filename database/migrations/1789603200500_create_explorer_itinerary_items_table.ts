import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The stops of an itinerary — ADR-0030.
 *
 * `position` is explicit because an itinerary is a sequence: ordering by
 * insertion time would lose the reordering the moment it exists.
 *
 * There is deliberately no uniqueness per establishment inside an itinerary.
 * Lunch and coming back at night are two stops at the same place, and the
 * schema has no business calling that a mistake.
 */
export default class extends BaseSchema {
  protected tableName = 'explorer_itinerary_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('itinerary_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('position').unsigned().notNullable().defaultTo(0)
      table.string('note', 280).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'explorer_itinerary_items_id_tenant_unique')

      table
        .foreign('tenant_id', 'explorer_itinerary_items_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      // Deleting an itinerary deletes its stops: a stop has no meaning alone.
      table
        .foreign(['itinerary_id', 'tenant_id'], 'explorer_itinerary_items_itinerary_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('explorer_itineraries')
        .onDelete('CASCADE')
      table
        .foreign(
          ['establishment_id', 'tenant_id'],
          'explorer_itinerary_items_establishment_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('RESTRICT')

      table.index(['tenant_id', 'itinerary_id', 'position'], 'explorer_itinerary_items_order_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
