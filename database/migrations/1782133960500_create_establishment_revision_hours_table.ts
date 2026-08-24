import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('establishment_revision_hours', (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('revision_id').unsigned().notNullable()
      table.smallint('weekday').notNullable()
      table.time('opens_at').notNullable()
      table.time('closes_at').notNullable()
      table.boolean('spans_next_day').notNullable().defaultTo(false)
      table.integer('sort_order').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['revision_id', 'weekday', 'opens_at', 'closes_at'],
        'establishment_revision_hours_interval_unique'
      )
      table.index(
        ['tenant_id', 'revision_id', 'weekday', 'sort_order'],
        'establishment_revision_hours_revision_index'
      )
      table
        .foreign(
          ['revision_id', 'tenant_id'],
          'establishment_revision_hours_revision_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishment_revisions')
        .onDelete('CASCADE')

      table.check('weekday BETWEEN 0 AND 6', [], 'establishment_revision_hours_weekday_check')
      table.check('opens_at <> closes_at', [], 'establishment_revision_hours_non_empty_check')
      table.check(
        '(spans_next_day = false AND opens_at < closes_at) OR (spans_next_day = true AND opens_at > closes_at)',
        [],
        'establishment_revision_hours_direction_check'
      )
      table.check('sort_order >= 0', [], 'establishment_revision_hours_sort_order_check')
    })

    this.schema.createTable('establishment_revision_special_days', (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('revision_id').unsigned().notNullable()
      table.date('date').notNullable()
      table.string('status', 16).notNullable()
      table.string('note', 240).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['revision_id', 'date'],
        'establishment_revision_special_days_revision_date_unique'
      )
      table.unique(
        ['id', 'tenant_id', 'revision_id'],
        'establishment_revision_special_days_id_tenant_revision_unique'
      )
      table.index(
        ['tenant_id', 'revision_id', 'date'],
        'establishment_revision_special_days_revision_index'
      )
      table
        .foreign(
          ['revision_id', 'tenant_id'],
          'establishment_revision_special_days_revision_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishment_revisions')
        .onDelete('CASCADE')

      table.check(
        "status IN ('closed', 'custom_hours')",
        [],
        'establishment_revision_special_days_status_check'
      )
    })

    this.schema.createTable('establishment_revision_special_hours', (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('special_day_id').unsigned().notNullable()
      table.integer('revision_id').unsigned().notNullable()
      table.time('opens_at').notNullable()
      table.time('closes_at').notNullable()
      table.boolean('spans_next_day').notNullable().defaultTo(false)
      table.integer('sort_order').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['special_day_id', 'opens_at', 'closes_at'],
        'establishment_revision_special_hours_interval_unique'
      )
      table
        .foreign(
          ['special_day_id', 'tenant_id', 'revision_id'],
          'establishment_revision_special_hours_day_tenant_revision_foreign'
        )
        .references(['id', 'tenant_id', 'revision_id'])
        .inTable('establishment_revision_special_days')
        .onDelete('CASCADE')

      table.check(
        'opens_at <> closes_at',
        [],
        'establishment_revision_special_hours_non_empty_check'
      )
      table.check(
        '(spans_next_day = false AND opens_at < closes_at) OR (spans_next_day = true AND opens_at > closes_at)',
        [],
        'establishment_revision_special_hours_direction_check'
      )
      table.check('sort_order >= 0', [], 'establishment_revision_special_hours_sort_order_check')
    })
  }

  async down() {
    this.schema.dropTable('establishment_revision_special_hours')
    this.schema.dropTable('establishment_revision_special_days')
    this.schema.dropTable('establishment_revision_hours')
  }
}
