import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Establishments an Explorer follows — ADR-0030, Anexo I item 10.
 *
 * Separate from favourites on purpose. A favourite recovers something; a
 * follow subscribes to what a partner publishes, and it is the relation that
 * one day decides who a notice reaches. Merging them would let a product
 * decision about notification be taken by a column value.
 *
 * The followed entity is the stable establishment of ADR-0012, never the
 * organization: the public identity of a partner is the city and slug pair of
 * ADR-0016, and an organization is not something a visitor ever sees.
 */
export default class extends BaseSchema {
  protected tableName = 'explorer_follows'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'explorer_follows_id_tenant_unique')
      // Doing it twice is the same intent, not two of them.
      table.unique(
        ['tenant_id', 'user_id', 'establishment_id'],
        'explorer_follows_user_target_unique'
      )

      table
        .foreign('tenant_id', 'explorer_follows_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      // Leaving the operation takes the preferences of that operation with it:
      // they never meant anything outside it.
      table
        .foreign(['user_id', 'tenant_id'], 'explorer_follows_user_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('CASCADE')
      // The target is never destroyed by someone's preference about it.
      table
        .foreign(['establishment_id', 'tenant_id'], 'explorer_follows_target_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('RESTRICT')

      table.index(['tenant_id', 'user_id', 'created_at'], 'explorer_follows_owner_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
