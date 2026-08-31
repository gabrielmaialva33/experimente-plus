import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'benefit_redemptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('access_id').unsigned().notNullable()
      table.integer('edition_id').unsigned().notNullable()
      table.integer('offer_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('organization_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.integer('redeemed_by').unsigned().notNullable()
      table.integer('redemption_number').unsigned().notNullable()
      table.string('presentation_nonce_hash', 64).notNullable()
      table.string('receipt_code', 24).notNullable()
      table.string('edition_name_snapshot', 160).notNullable()
      table.string('offer_title_snapshot', 180).notNullable()
      table.string('benefit_type_snapshot', 32).notNullable()
      table.text('offer_terms_snapshot').nullable()
      table.string('establishment_name_snapshot', 180).notNullable()
      table.string('holder_name_snapshot', 160).notNullable()
      table.string('holder_email_snapshot', 254).notNullable()
      table.timestamp('redeemed_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'benefit_redemptions_id_tenant_unique')
      table.unique(['tenant_id', 'receipt_code'], 'benefit_redemptions_receipt_unique')
      table.unique(['presentation_nonce_hash'], 'benefit_redemptions_nonce_unique')
      table.unique(
        ['access_id', 'offer_id', 'redemption_number'],
        'benefit_redemptions_access_offer_number_unique'
      )

      table
        .foreign('tenant_id', 'benefit_redemptions_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['access_id', 'tenant_id'], 'benefit_redemptions_access_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('benefit_accesses')
        .onDelete('RESTRICT')
      table
        .foreign(['edition_id', 'tenant_id'], 'benefit_redemptions_edition_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('benefit_editions')
        .onDelete('RESTRICT')
      table
        .foreign(['offer_id', 'tenant_id'], 'benefit_redemptions_offer_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('benefit_offers')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['establishment_id', 'tenant_id'],
          'benefit_redemptions_establishment_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['organization_id', 'tenant_id'],
          'benefit_redemptions_organization_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('organizations')
        .onDelete('RESTRICT')
      table
        .foreign(['user_id', 'tenant_id'], 'benefit_redemptions_holder_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('RESTRICT')
      table
        .foreign(['redeemed_by', 'tenant_id'], 'benefit_redemptions_redeemer_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('RESTRICT')

      table.index(
        ['tenant_id', 'user_id', 'redeemed_at'],
        'benefit_redemptions_holder_history_index'
      )
      table.index(
        ['tenant_id', 'organization_id', 'redeemed_at'],
        'benefit_redemptions_partner_history_index'
      )
      table.index(
        ['tenant_id', 'establishment_id', 'redeemed_at'],
        'benefit_redemptions_establishment_history_index'
      )

      table.check('redemption_number > 0', [], 'benefit_redemptions_number_check')
      table.check(
        "presentation_nonce_hash ~ '^[0-9a-f]{64}$'",
        [],
        'benefit_redemptions_nonce_hash_check'
      )
      table.check(
        "benefit_type_snapshot IN ('buy_one_get_one', 'percentage', 'fixed_amount', 'complimentary_item', 'custom')",
        [],
        'benefit_redemptions_type_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
