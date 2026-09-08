import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable().primary()

      table.string('full_name').notNullable()

      table.string('email', 254).notNullable().unique()
      table.string('username', 80).nullable().unique()
      table.check('email = lower(email)', [], 'users_email_lowercase_check')
      table.check(
        "username IS NULL OR (username = lower(username) AND username ~ '^[a-z0-9][a-z0-9._-]*$')",
        [],
        'users_username_canonical_check'
      )
      table.string('password').notNullable()
      table.integer('credential_version').notNullable().defaultTo(1)
      table.check('credential_version > 0', [], 'users_credential_version_positive_check')

      table.boolean('is_deleted').defaultTo(false)

      table.jsonb('metadata').defaultTo(
        JSON.stringify({
          email_verified: false,
          email_verification_token_hash: null,
          email_verification_sent_at: null,
          email_verified_at: null,
        })
      )

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
