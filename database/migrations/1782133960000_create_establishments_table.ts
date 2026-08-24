import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'establishments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('organization_id').unsigned().notNullable()
      table.string('lifecycle_status', 24).notNullable().defaultTo('active')
      table.string('business_status', 32).notNullable().defaultTo('open')
      table.integer('published_revision_id').unsigned().nullable()
      table.integer('created_by').unsigned().nullable()
      table.timestamp('suspended_at', { useTz: true }).nullable()
      table.timestamp('archived_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'establishments_id_tenant_unique')
      table.unique(
        ['id', 'tenant_id', 'organization_id'],
        'establishments_id_tenant_organization_unique'
      )

      table
        .foreign('tenant_id', 'establishments_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['organization_id', 'tenant_id'], 'establishments_organization_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('organizations')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')
      table
        .foreign('created_by', 'establishments_created_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.index(['tenant_id', 'organization_id'], 'establishments_organization_index')
      table.index(['tenant_id', 'lifecycle_status'], 'establishments_lifecycle_index')
      table.index(['tenant_id', 'business_status'], 'establishments_business_status_index')
      table.index(['published_revision_id'], 'establishments_published_revision_index')

      table.check(
        "lifecycle_status IN ('active', 'suspended', 'archived')",
        [],
        'establishments_lifecycle_status_check'
      )
      table.check(
        "business_status IN ('open', 'temporarily_closed', 'permanently_closed')",
        [],
        'establishments_business_status_check'
      )
      table.check(
        `(lifecycle_status = 'active' AND suspended_at IS NULL AND archived_at IS NULL)
          OR (lifecycle_status = 'suspended' AND suspended_at IS NOT NULL AND archived_at IS NULL)
          OR (lifecycle_status = 'archived' AND archived_at IS NOT NULL)`,
        [],
        'establishments_lifecycle_timestamps_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
