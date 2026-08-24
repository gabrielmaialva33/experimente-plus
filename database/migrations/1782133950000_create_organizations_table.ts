import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'organizations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table.string('legal_name', 180).notNullable()
      table.string('trade_name', 160).notNullable()
      table.string('slug', 180).notNullable()
      table.string('tax_id', 14).notNullable()
      table.string('email', 254).notNullable()
      table.string('phone', 15).notNullable()
      table.string('website', 2048).nullable()
      table.string('status', 32).notNullable().defaultTo('draft')
      table
        .integer('created_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table
        .integer('reviewed_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('reviewed_at', { useTz: true }).nullable()
      table.text('review_notes').nullable()
      table.timestamp('suspended_at', { useTz: true }).nullable()
      table.timestamp('archived_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'slug'], 'organizations_tenant_id_slug_unique')
      table.unique(['tenant_id', 'tax_id'], 'organizations_tenant_id_tax_id_unique')
      table.unique(['id', 'tenant_id'], 'organizations_id_tenant_id_unique')
      table.index(['tenant_id', 'status', 'trade_name'], 'organizations_admin_index')
      table.index(['tenant_id', 'created_by'], 'organizations_created_by_index')

      table.check("tax_id ~ '^[0-9]{14}$'", [], 'organizations_tax_id_check')
      table.check('email = lower(email)', [], 'organizations_email_lowercase_check')
      table.check("phone ~ '^[0-9]{10,15}$'", [], 'organizations_phone_check')
      table.check(
        "status IN ('draft', 'pending_review', 'changes_requested', 'active', 'rejected', 'suspended', 'archived')",
        [],
        'organizations_status_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
