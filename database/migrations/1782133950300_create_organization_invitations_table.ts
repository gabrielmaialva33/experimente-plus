import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'organization_invitations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('organization_id').unsigned().notNullable()
      table.string('email', 254).notNullable()
      table.string('role', 24).notNullable()
      table.string('token_hash', 64).notNullable().unique()
      table
        .integer('invited_by')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table
        .integer('accepted_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('accepted_at', { useTz: true }).nullable()
      table
        .integer('revoked_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('revoked_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'organization_invitations_id_tenant_id_unique')
      table.index(
        ['tenant_id', 'organization_id', 'expires_at'],
        'organization_invitations_organization_index'
      )
      table.index(['email', 'expires_at'], 'organization_invitations_email_index')

      table
        .foreign(
          ['organization_id', 'tenant_id'],
          'organization_invitations_organization_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('organizations')
        .onDelete('CASCADE')

      table.check(
        "role IN ('owner', 'admin', 'editor', 'analyst')",
        [],
        'organization_invitations_role_check'
      )
      table.check('email = lower(email)', [], 'organization_invitations_email_lowercase_check')
      table.check(
        '(accepted_at IS NULL AND accepted_by IS NULL) OR (accepted_at IS NOT NULL AND accepted_by IS NOT NULL)',
        [],
        'organization_invitations_accepted_pair_check'
      )
      table.check(
        '(revoked_at IS NULL AND revoked_by IS NULL) OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)',
        [],
        'organization_invitations_revoked_pair_check'
      )
      table.check(
        'NOT (accepted_at IS NOT NULL AND revoked_at IS NOT NULL)',
        [],
        'organization_invitations_terminal_state_check'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery(
        `CREATE UNIQUE INDEX organization_invitations_pending_email_unique
         ON organization_invitations (organization_id, lower(email))
         WHERE accepted_at IS NULL AND revoked_at IS NULL`
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
