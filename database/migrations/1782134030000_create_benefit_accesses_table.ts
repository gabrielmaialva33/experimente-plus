import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'benefit_accesses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('edition_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.string('source', 24).notNullable().defaultTo('manual')
      table.string('status', 24).notNullable().defaultTo('active')
      table.string('external_reference', 255).nullable()
      table.text('notes').nullable()
      table.integer('granted_by').unsigned().nullable()
      table.timestamp('granted_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.integer('revoked_by').unsigned().nullable()
      table.timestamp('revoked_at', { useTz: true }).nullable()
      table.text('revocation_reason').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'benefit_accesses_id_tenant_unique')

      table
        .foreign('tenant_id', 'benefit_accesses_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['edition_id', 'tenant_id'], 'benefit_accesses_edition_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('benefit_editions')
        .onDelete('RESTRICT')
      table
        .foreign(['user_id', 'tenant_id'], 'benefit_accesses_holder_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('RESTRICT')
      table
        .foreign('granted_by', 'benefit_accesses_granted_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .foreign('revoked_by', 'benefit_accesses_revoked_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.index(['tenant_id', 'user_id', 'status', 'granted_at'], 'benefit_accesses_holder_index')
      table.index(
        ['tenant_id', 'edition_id', 'status', 'granted_at'],
        'benefit_accesses_edition_index'
      )

      table.check(
        "source IN ('manual', 'courtesy', 'payment', 'promo_code', 'migration')",
        [],
        'benefit_accesses_source_check'
      )
      table.check("status IN ('active', 'revoked')", [], 'benefit_accesses_status_check')
      table.check(
        `(
          status = 'active'
          AND revoked_at IS NULL
          AND revoked_by IS NULL
          AND revocation_reason IS NULL
        ) OR (
          status = 'revoked'
          AND revoked_at IS NOT NULL
        )`,
        [],
        'benefit_accesses_revocation_state_check'
      )
      table.check(
        "source <> 'payment' OR external_reference IS NOT NULL",
        [],
        'benefit_accesses_payment_reference_check'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE UNIQUE INDEX benefit_accesses_active_holder_unique
        ON benefit_accesses (tenant_id, edition_id, user_id)
        WHERE status = 'active'
      `)
      await db.rawQuery(`
        CREATE UNIQUE INDEX benefit_accesses_external_reference_unique
        ON benefit_accesses (tenant_id, source, external_reference)
        WHERE external_reference IS NOT NULL
      `)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
