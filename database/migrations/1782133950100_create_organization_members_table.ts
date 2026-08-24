import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'organization_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('organization_id').unsigned().notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('role', 24).notNullable()
      table.string('status', 24).notNullable().defaultTo('active')
      table
        .integer('invited_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('suspended_at', { useTz: true }).nullable()
      table.timestamp('removed_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['organization_id', 'user_id'], 'organization_members_organization_user_unique')
      table.unique(['id', 'tenant_id'], 'organization_members_id_tenant_id_unique')
      table.index(
        ['tenant_id', 'user_id', 'status'],
        'organization_members_user_tenant_status_index'
      )
      table.index(
        ['tenant_id', 'organization_id', 'status', 'role'],
        'organization_members_organization_status_index'
      )

      table
        .foreign(
          ['organization_id', 'tenant_id'],
          'organization_members_organization_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('organizations')
        .onDelete('CASCADE')

      table.check(
        "role IN ('owner', 'admin', 'editor', 'analyst')",
        [],
        'organization_members_role_check'
      )
      table.check(
        "status IN ('active', 'suspended', 'removed')",
        [],
        'organization_members_status_check'
      )
      table.check(
        "(status = 'active' AND suspended_at IS NULL AND removed_at IS NULL) OR (status = 'suspended' AND suspended_at IS NOT NULL AND removed_at IS NULL) OR (status = 'removed' AND removed_at IS NOT NULL)",
        [],
        'organization_members_state_timestamps_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
