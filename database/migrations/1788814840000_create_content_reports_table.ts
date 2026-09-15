import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'content_reports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.string('target_type', 32).notNullable()
      table.integer('target_id').unsigned().notNullable()
      table.integer('reporter_id').unsigned().notNullable()
      table.string('reason', 40).notNullable()
      table.text('details').nullable()
      table.string('status', 24).notNullable().defaultTo('pending')
      table.integer('resolved_by').unsigned().nullable()
      table.timestamp('resolved_at', { useTz: true }).nullable()
      table.string('resolution_action', 40).nullable()
      table.text('resolution_notes').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'content_reports_id_tenant_unique')
      table.unique(
        ['tenant_id', 'target_type', 'target_id', 'reporter_id'],
        'content_reports_target_reporter_unique'
      )

      table
        .foreign('tenant_id', 'content_reports_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['reporter_id', 'tenant_id'], 'content_reports_reporter_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('RESTRICT')
      table
        .foreign('resolved_by', 'content_reports_resolved_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.index(
        ['tenant_id', 'status', 'created_at'],
        'content_reports_tenant_status_created_index'
      )
      table.index(
        ['tenant_id', 'target_type', 'target_id', 'status'],
        'content_reports_target_status_index'
      )
      table.index(
        ['tenant_id', 'reporter_id', 'created_at'],
        'content_reports_reporter_created_index'
      )

      table.check(
        "target_type IN ('review', 'reply', 'establishment')",
        [],
        'content_reports_target_type_check'
      )
      table.check(
        "reason IN ('spam', 'offensive', 'inappropriate', 'false_information', 'conflict_of_interest', 'harassment', 'other')",
        [],
        'content_reports_reason_check'
      )
      table.check(
        "status IN ('pending', 'under_review', 'resolved', 'dismissed')",
        [],
        'content_reports_status_check'
      )
      table.check(
        `(
          status IN ('pending', 'under_review')
          AND resolved_by IS NULL
          AND resolved_at IS NULL
        ) OR (
          status IN ('resolved', 'dismissed')
          AND resolved_by IS NOT NULL
          AND resolved_at IS NOT NULL
        )`,
        [],
        'content_reports_resolution_state_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
