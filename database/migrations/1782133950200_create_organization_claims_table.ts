import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'organization_claims'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('organization_id').unsigned().notNullable()
      table
        .integer('claimant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('status', 24).notNullable().defaultTo('pending')
      table.text('message').nullable()
      table.json('evidence').nullable()
      table
        .integer('reviewed_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('reviewed_at', { useTz: true }).nullable()
      table.text('review_notes').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'organization_claims_id_tenant_id_unique')
      table.index(
        ['tenant_id', 'organization_id', 'status', 'created_at'],
        'organization_claims_review_queue_index'
      )
      table.index(['tenant_id', 'claimant_id', 'status'], 'organization_claims_claimant_index')

      table
        .foreign(
          ['organization_id', 'tenant_id'],
          'organization_claims_organization_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('organizations')
        .onDelete('CASCADE')

      table.check(
        "status IN ('pending', 'approved', 'rejected', 'cancelled')",
        [],
        'organization_claims_status_check'
      )
      table.check(
        "(status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL) OR (status = 'cancelled') OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)",
        [],
        'organization_claims_review_state_check'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery(
        `CREATE UNIQUE INDEX organization_claims_pending_claimant_unique
         ON organization_claims (organization_id, claimant_id)
         WHERE status = 'pending'`
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
