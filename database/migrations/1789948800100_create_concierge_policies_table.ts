import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Concierge parameters per operation — ADR-0029, revision of 26/09/2026;
 * Anexo I items 12 and 15.
 *
 * One row per tenant, like the review and automatic moderation policies. The
 * provider, its models and its key stay in the environment: they are
 * infrastructure and credentials, not something an operator edits on a screen.
 * What lives here is what the operation decides — whether its assistant
 * answers, how much of the catalogue enters a question, and how many questions
 * one person may ask a day. None of the defaults is a decision of the
 * contracting party; they repeat the values the ADR proposed.
 *
 * The ranges are enforced by the table as well as by the validator, so no
 * write path can store a value the assistant was never measured against.
 */
export default class extends BaseSchema {
  protected tableName = 'concierge_policies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.boolean('enabled').notNullable().defaultTo(true)
      table.integer('max_catalog_items').notNullable().defaultTo(20)
      table.integer('daily_questions_per_person').notNullable().defaultTo(20)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id'], 'concierge_policies_tenant_unique')
      table
        .foreign('tenant_id', 'concierge_policies_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      table.check(
        'max_catalog_items BETWEEN 8 AND 40',
        [],
        'concierge_policies_max_catalog_items_check'
      )
      table.check(
        'daily_questions_per_person BETWEEN 1 AND 200',
        [],
        'concierge_policies_daily_questions_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
