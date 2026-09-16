import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'partner_content_policies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      // Proposed, configurable defaults from ADR-0028; not a product-owner decision.
      table.boolean('require_experience_approval').notNullable().defaultTo(false)
      table.boolean('require_event_approval').notNullable().defaultTo(true)
      table.boolean('require_showcase_item_approval').notNullable().defaultTo(false)
      table.integer('max_media_per_content').unsigned().notNullable().defaultTo(6)
      // Zero means no minimum advance notice. The future service resolves the city's timezone.
      table.integer('min_event_notice_minutes').unsigned().notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'partner_content_policies_id_tenant_unique')
      table.unique(['tenant_id'], 'partner_content_policies_tenant_unique')
      table
        .foreign('tenant_id', 'partner_content_policies_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('RESTRICT')
      table.check('max_media_per_content >= 0', [], 'partner_content_policies_max_media_check')
      table.check(
        'min_event_notice_minutes >= 0',
        [],
        'partner_content_policies_event_notice_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
