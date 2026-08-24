import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'establishment_revision_addresses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('revision_id').unsigned().notNullable()
      table.string('postal_code', 8).nullable()
      table.string('street', 160).nullable()
      table.string('number', 32).nullable()
      table.boolean('without_number').notNullable().defaultTo(false)
      table.string('complement', 160).nullable()
      table.string('district', 120).nullable()
      table.string('reference', 240).nullable()
      table.decimal('latitude', 10, 7).nullable()
      table.decimal('longitude', 10, 7).nullable()
      table.string('coordinate_source', 16).nullable()
      table.timestamp('geocoded_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['revision_id'], 'establishment_revision_addresses_revision_unique')
      table.unique(
        ['id', 'tenant_id', 'revision_id'],
        'establishment_revision_addresses_id_tenant_revision_unique'
      )
      table
        .foreign(
          ['revision_id', 'tenant_id'],
          'establishment_revision_addresses_revision_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishment_revisions')
        .onDelete('CASCADE')

      table.check(
        "postal_code IS NULL OR postal_code ~ '^[0-9]{8}$'",
        [],
        'establishment_revision_addresses_postal_code_check'
      )
      table.check(
        'without_number = false OR number IS NULL',
        [],
        'establishment_revision_addresses_number_state_check'
      )
      table.check(
        '(latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)',
        [],
        'establishment_revision_addresses_coordinates_pair_check'
      )
      table.check(
        'latitude IS NULL OR latitude BETWEEN -90 AND 90',
        [],
        'establishment_revision_addresses_latitude_check'
      )
      table.check(
        'longitude IS NULL OR longitude BETWEEN -180 AND 180',
        [],
        'establishment_revision_addresses_longitude_check'
      )
      table.check(
        "coordinate_source IS NULL OR coordinate_source IN ('manual', 'geocoded', 'imported')",
        [],
        'establishment_revision_addresses_coordinate_source_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
