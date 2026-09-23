import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Discovery interests of the Explorer — ADR-0030, Anexo I item 10.
 *
 * An interest points at a category of the operation itself rather than at a
 * free-text vocabulary: two dictionaries for the same idea would leave the
 * second one to age alone, disconnected from the taxonomy that actually
 * organises discovery.
 *
 * Registering an interest changes no ordering in this milestone. Personalised
 * ranking is its own domain, and doing it here would create prominence with
 * no prominence contract.
 */
export default class extends BaseSchema {
  protected tableName = 'explorer_interests'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.integer('category_id').unsigned().notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'explorer_interests_id_tenant_unique')
      // Doing it twice is the same intent, not two of them.
      table.unique(['tenant_id', 'user_id', 'category_id'], 'explorer_interests_user_target_unique')

      table
        .foreign('tenant_id', 'explorer_interests_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      // Leaving the operation takes the preferences of that operation with it:
      // they never meant anything outside it.
      table
        .foreign(['user_id', 'tenant_id'], 'explorer_interests_user_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('CASCADE')
      // The target is never destroyed by someone's preference about it.
      table
        .foreign(['category_id', 'tenant_id'], 'explorer_interests_target_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('categories')
        .onDelete('RESTRICT')

      table.index(['tenant_id', 'user_id', 'created_at'], 'explorer_interests_owner_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
