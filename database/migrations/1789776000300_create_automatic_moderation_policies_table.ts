import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Automatic moderation rules per operation — ADR-0031, Anexo I item 9.
 *
 * One row per tenant, like the review and partner-content policies. Each
 * detector has a mode — `off`, `flag` (publish and open a report) or `hold`
 * (keep out of public view until a person decides) — and the blocked terms are
 * the operation's own list. None of these values is a decision of the
 * contracting party yet; the defaults exist to make the feature buildable and
 * are recorded as provisional in the ADR.
 */
export default class extends BaseSchema {
  protected tableName = 'automatic_moderation_policies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.string('link_mode', 8).notNullable().defaultTo('flag')
      table.string('contact_mode', 8).notNullable().defaultTo('hold')
      table.string('payment_data_mode', 8).notNullable().defaultTo('hold')
      table.string('blocked_term_mode', 8).notNullable().defaultTo('hold')
      table.jsonb('blocked_terms').notNullable().defaultTo(this.raw("'[]'::jsonb"))
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id'], 'automatic_moderation_policies_tenant_unique')
      table
        .foreign('tenant_id', 'automatic_moderation_policies_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      for (const column of [
        'link_mode',
        'contact_mode',
        'payment_data_mode',
        'blocked_term_mode',
      ]) {
        table.check(
          `${column} IN ('off', 'flag', 'hold')`,
          [],
          `automatic_moderation_policies_${column}_check`
        )
      }
      table.check(
        "jsonb_typeof(blocked_terms) = 'array'",
        [],
        'automatic_moderation_policies_terms_array_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
