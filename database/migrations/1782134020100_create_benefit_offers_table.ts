import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'benefit_offers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('edition_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.string('title', 180).notNullable()
      table.text('description').notNullable()
      table.string('benefit_type', 32).notNullable()
      table.integer('discount_percentage').unsigned().nullable()
      table.integer('discount_amount_cents').unsigned().nullable()
      table.text('terms').nullable()
      table.integer('available_weekdays_mask').unsigned().notNullable().defaultTo(127)
      table.string('daily_start_time', 5).nullable()
      table.string('daily_end_time', 5).nullable()
      table.timestamp('starts_at', { useTz: true }).nullable()
      table.timestamp('ends_at', { useTz: true }).nullable()
      table.boolean('reservation_required').notNullable().defaultTo(false)
      table.boolean('on_premise_only').notNullable().defaultTo(true)
      table.integer('minimum_party_size').unsigned().notNullable().defaultTo(1)
      table.integer('max_redemptions_per_access').unsigned().notNullable().defaultTo(1)
      table.string('status', 24).notNullable().defaultTo('draft')
      table.integer('created_by').unsigned().nullable()
      table.timestamp('activated_at', { useTz: true }).nullable()
      table.timestamp('archived_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['edition_id', 'establishment_id'],
        'benefit_offers_edition_establishment_unique'
      )
      table.unique(['id', 'tenant_id'], 'benefit_offers_id_tenant_unique')

      table
        .foreign('tenant_id', 'benefit_offers_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['edition_id', 'tenant_id'], 'benefit_offers_edition_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('benefit_editions')
        .onDelete('CASCADE')
      table
        .foreign(['establishment_id', 'tenant_id'], 'benefit_offers_establishment_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('RESTRICT')
      table
        .foreign('created_by', 'benefit_offers_created_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.index(['tenant_id', 'edition_id', 'status'], 'benefit_offers_edition_status_index')
      table.index(
        ['tenant_id', 'establishment_id', 'status'],
        'benefit_offers_establishment_status_index'
      )

      table.check(
        "benefit_type IN ('buy_one_get_one', 'percentage', 'fixed_amount', 'complimentary_item', 'custom')",
        [],
        'benefit_offers_type_check'
      )
      table.check(
        `(
          benefit_type = 'percentage'
          AND discount_percentage BETWEEN 1 AND 100
          AND discount_amount_cents IS NULL
        ) OR (
          benefit_type = 'fixed_amount'
          AND discount_amount_cents > 0
          AND discount_percentage IS NULL
        ) OR (
          benefit_type IN ('buy_one_get_one', 'complimentary_item', 'custom')
          AND discount_percentage IS NULL
          AND discount_amount_cents IS NULL
        )`,
        [],
        'benefit_offers_value_shape_check'
      )
      table.check('available_weekdays_mask BETWEEN 1 AND 127', [], 'benefit_offers_weekdays_check')
      table.check(
        `(
          daily_start_time IS NULL AND daily_end_time IS NULL
        ) OR (
          daily_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          AND daily_end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          AND daily_end_time > daily_start_time
        )`,
        [],
        'benefit_offers_daily_window_check'
      )
      table.check(
        `(
          starts_at IS NULL AND ends_at IS NULL
        ) OR (
          starts_at IS NOT NULL
          AND ends_at IS NOT NULL
          AND ends_at > starts_at
        )`,
        [],
        'benefit_offers_override_window_check'
      )
      table.check('minimum_party_size > 0', [], 'benefit_offers_party_size_check')
      table.check('max_redemptions_per_access > 0', [], 'benefit_offers_redemption_limit_check')
      table.check(
        "status IN ('draft', 'active', 'paused', 'archived')",
        [],
        'benefit_offers_status_check'
      )
      table.check(
        `(
          status = 'draft'
          AND activated_at IS NULL
          AND archived_at IS NULL
        ) OR (
          status IN ('active', 'paused')
          AND activated_at IS NOT NULL
          AND archived_at IS NULL
        ) OR (
          status = 'archived'
          AND archived_at IS NOT NULL
        )`,
        [],
        'benefit_offers_state_timestamps_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
