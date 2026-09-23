import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The history of bans — ADR-0027 §6, "preserved in history and audit".
 *
 * Append-only, like the revision and media moderation events. The current
 * state lives on the membership; this is what was done, by whom and why.
 *
 * It references the user and the tenant separately rather than the membership,
 * on purpose: an audit trail must outlive the membership it is about, and a
 * composite key to `user_tenants` would either block removing a membership or
 * erase the record of why it was banned.
 */
export default class extends BaseSchema {
  protected tableName = 'user_ban_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.string('action', 16).notNullable()
      table.string('reason', 500).nullable()
      table.integer('actor_id').unsigned().notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table
        .foreign('tenant_id', 'user_ban_events_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign('user_id', 'user_ban_events_user_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table
        .foreign('actor_id', 'user_ban_events_actor_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.index(['tenant_id', 'user_id', 'created_at'], 'user_ban_events_subject_index')
      table.check("action IN ('banned', 'unbanned')", [], 'user_ban_events_action_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
