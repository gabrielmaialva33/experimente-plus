import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Private bookmarks of the Explorer — ADR-0030, Anexo I item 10.
 *
 * A favourite is about retrieval and belongs to whoever saved it. No route
 * lists who favourited an establishment: that would turn a private preference
 * into something third parties can observe, which nothing in the scope asks
 * for.
 */
export default class extends BaseSchema {
  protected tableName = 'explorer_favorites'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'explorer_favorites_id_tenant_unique')
      // Doing it twice is the same intent, not two of them.
      table.unique(
        ['tenant_id', 'user_id', 'establishment_id'],
        'explorer_favorites_user_target_unique'
      )

      table
        .foreign('tenant_id', 'explorer_favorites_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      // Leaving the operation takes the preferences of that operation with it:
      // they never meant anything outside it.
      table
        .foreign(['user_id', 'tenant_id'], 'explorer_favorites_user_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('CASCADE')
      // The target is never destroyed by someone's preference about it.
      table
        .foreign(['establishment_id', 'tenant_id'], 'explorer_favorites_target_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('RESTRICT')

      table.index(['tenant_id', 'user_id', 'created_at'], 'explorer_favorites_owner_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
