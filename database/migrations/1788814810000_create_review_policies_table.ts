import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'review_policies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.boolean('require_visit_proof').notNullable().defaultTo(false)
      table.integer('min_text_length').unsigned().notNullable().defaultTo(0)
      table.integer('max_text_length').unsigned().notNullable().defaultTo(1000)
      table.integer('max_photos').unsigned().notNullable().defaultTo(4)
      table.integer('max_videos').unsigned().notNullable().defaultTo(0)
      table.integer('daily_limit_per_user').unsigned().notNullable().defaultTo(5)
      table.integer('min_edit_interval_minutes').unsigned().notNullable().defaultTo(60)
      table.integer('edit_window_days').unsigned().notNullable().defaultTo(30)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'review_policies_id_tenant_unique')
      table.unique(['tenant_id'], 'review_policies_tenant_unique')

      table
        .foreign('tenant_id', 'review_policies_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')

      table.check('min_text_length <= max_text_length', [], 'review_policies_text_length_check')
      table.check('max_text_length >= 0', [], 'review_policies_max_text_length_check')
      table.check('max_photos >= 0', [], 'review_policies_max_photos_check')
      table.check('max_videos >= 0', [], 'review_policies_max_videos_check')
      table.check('daily_limit_per_user >= 0', [], 'review_policies_daily_limit_check')
      table.check('min_edit_interval_minutes >= 0', [], 'review_policies_min_edit_interval_check')
      table.check('edit_window_days >= 0', [], 'review_policies_edit_window_days_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
