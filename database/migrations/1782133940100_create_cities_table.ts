import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'cities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('tenant_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table.integer('region_id').unsigned().notNullable()
      table.string('name', 120).notNullable()
      table.string('slug', 140).notNullable()
      table.string('state_code', 2).notNullable()
      table.string('country_code', 2).notNullable().defaultTo('BR')
      table.string('ibge_code', 7).nullable()
      table.string('timezone', 64).notNullable().defaultTo('America/Sao_Paulo')
      table.decimal('latitude', 9, 6).nullable()
      table.decimal('longitude', 9, 6).nullable()
      table.integer('sort_order').notNullable().defaultTo(0)
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['tenant_id', 'slug'], 'cities_tenant_id_slug_unique')
      table.unique(['tenant_id', 'ibge_code'], 'cities_tenant_id_ibge_code_unique')
      table.unique(['id', 'tenant_id'], 'cities_id_tenant_id_unique')
      table.index(['tenant_id', 'region_id', 'is_active', 'sort_order'], 'cities_catalog_index')

      table
        .foreign(['region_id', 'tenant_id'], 'cities_region_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('regions')
        .onDelete('RESTRICT')

      table.check('sort_order >= 0', [], 'cities_sort_order_check')
      table.check(
        'char_length(state_code) = 2 AND state_code = upper(state_code)',
        [],
        'cities_state_code_check'
      )
      table.check(
        'char_length(country_code) = 2 AND country_code = upper(country_code)',
        [],
        'cities_country_code_check'
      )
      table.check("ibge_code IS NULL OR ibge_code ~ '^[0-9]{7}$'", [], 'cities_ibge_code_check')
      table.check(
        '(latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)',
        [],
        'cities_coordinates_pair_check'
      )
      table.check(
        'latitude IS NULL OR (latitude >= -90 AND latitude <= 90)',
        [],
        'cities_latitude_check'
      )
      table.check(
        'longitude IS NULL OR (longitude >= -180 AND longitude <= 180)',
        [],
        'cities_longitude_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
