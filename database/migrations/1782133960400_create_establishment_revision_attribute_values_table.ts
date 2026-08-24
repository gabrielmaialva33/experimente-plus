import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('establishment_revision_attribute_values', (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('revision_id').unsigned().notNullable()
      table.integer('attribute_definition_id').unsigned().notNullable()
      table.text('value_text').nullable()
      table.boolean('value_boolean').nullable()
      table.integer('value_integer').nullable()
      table.decimal('value_decimal', 14, 4).nullable()
      table.string('value_url', 2048).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['revision_id', 'attribute_definition_id'],
        'establishment_revision_attribute_values_revision_definition_unique'
      )
      table.unique(
        ['id', 'tenant_id', 'attribute_definition_id'],
        'establishment_revision_attribute_values_id_tenant_definition_unique'
      )
      table
        .foreign(
          ['revision_id', 'tenant_id'],
          'establishment_revision_attribute_values_revision_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishment_revisions')
        .onDelete('CASCADE')
      table
        .foreign(
          ['attribute_definition_id', 'tenant_id'],
          'establishment_revision_attribute_values_definition_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('category_attribute_definitions')
        .onDelete('RESTRICT')

      table.check(
        '(CASE WHEN value_text IS NULL THEN 0 ELSE 1 END + CASE WHEN value_boolean IS NULL THEN 0 ELSE 1 END + CASE WHEN value_integer IS NULL THEN 0 ELSE 1 END + CASE WHEN value_decimal IS NULL THEN 0 ELSE 1 END + CASE WHEN value_url IS NULL THEN 0 ELSE 1 END) <= 1',
        [],
        'establishment_revision_attribute_values_single_scalar_check'
      )
    })

    this.schema.createTable('establishment_revision_attribute_value_options', (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('attribute_value_id').unsigned().notNullable()
      table.integer('attribute_definition_id').unsigned().notNullable()
      table.integer('attribute_option_id').unsigned().notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['attribute_value_id', 'attribute_option_id'],
        'establishment_revision_attribute_value_options_value_option_unique'
      )
      table
        .foreign(
          ['attribute_value_id', 'tenant_id', 'attribute_definition_id'],
          'establishment_revision_attribute_value_options_value_tenant_definition_foreign'
        )
        .references(['id', 'tenant_id', 'attribute_definition_id'])
        .inTable('establishment_revision_attribute_values')
        .onDelete('CASCADE')
      table
        .foreign(
          ['attribute_option_id', 'tenant_id', 'attribute_definition_id'],
          'establishment_revision_attribute_value_options_option_tenant_definition_foreign'
        )
        .references(['id', 'tenant_id', 'attribute_definition_id'])
        .inTable('category_attribute_options')
        .onDelete('RESTRICT')
    })
  }

  async down() {
    this.schema.dropTable('establishment_revision_attribute_value_options')
    this.schema.dropTable('establishment_revision_attribute_values')
  }
}
