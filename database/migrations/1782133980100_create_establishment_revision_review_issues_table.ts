import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'establishment_revision_review_issues'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('revision_id').unsigned().notNullable()
      table.string('code', 80).notNullable()
      table.string('field', 160).notNullable().defaultTo('general')
      table.string('message', 1000).notNullable()
      table.string('severity', 16).notNullable().defaultTo('blocking')
      table.integer('created_by').unsigned().notNullable()
      table.integer('resolved_by').unsigned().nullable()
      table.timestamp('resolved_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['id', 'tenant_id', 'establishment_id', 'revision_id'],
        'establishment_revision_review_issues_identity_unique'
      )
      table.index(
        ['tenant_id', 'establishment_id', 'revision_id', 'resolved_at'],
        'establishment_revision_review_issues_revision_index'
      )
      table.index(
        ['tenant_id', 'severity', 'resolved_at'],
        'establishment_revision_review_issues_severity_index'
      )

      table
        .foreign('tenant_id', 'establishment_revision_review_issues_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(
          ['revision_id', 'tenant_id', 'establishment_id'],
          'establishment_revision_review_issues_revision_tenant_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_revisions')
        .onDelete('CASCADE')
      table
        .foreign('created_by', 'establishment_revision_review_issues_created_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table
        .foreign('resolved_by', 'establishment_revision_review_issues_resolved_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.check(
        "code ~ '^[a-z][a-z0-9_]{1,79}$'",
        [],
        'establishment_revision_review_issues_code_check'
      )
      table.check(
        "NULLIF(btrim(field), '') IS NOT NULL",
        [],
        'establishment_revision_review_issues_field_check'
      )
      table.check(
        "NULLIF(btrim(message), '') IS NOT NULL",
        [],
        'establishment_revision_review_issues_message_check'
      )
      table.check(
        "severity IN ('blocking', 'warning')",
        [],
        'establishment_revision_review_issues_severity_check'
      )
      table.check(
        '(resolved_by IS NULL AND resolved_at IS NULL) OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL)',
        [],
        'establishment_revision_review_issues_resolution_check'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE UNIQUE INDEX establishment_revision_review_issues_open_unique
        ON establishment_revision_review_issues (revision_id, code, field)
        WHERE resolved_at IS NULL
      `)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
