import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pilot_feedback'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.integer('organization_id').unsigned().nullable()
      table.integer('establishment_id').unsigned().nullable()
      table.string('context', 32).notNullable().defaultTo('general')
      table.integer('rating').unsigned().notNullable()
      table.text('message').notNullable()
      table.string('status', 24).notNullable().defaultTo('new')
      table.integer('reviewed_by').unsigned().nullable()
      table.timestamp('reviewed_at', { useTz: true }).nullable()
      table.text('internal_notes').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(
        ['tenant_id', 'status', 'created_at'],
        'pilot_feedback_tenant_status_created_index'
      )
      table.index(['user_id', 'created_at'], 'pilot_feedback_user_created_index')
      table.index(
        ['tenant_id', 'organization_id', 'created_at'],
        'pilot_feedback_organization_created_index'
      )
      table.index(
        ['tenant_id', 'establishment_id', 'created_at'],
        'pilot_feedback_establishment_created_index'
      )

      table
        .foreign('tenant_id', 'pilot_feedback_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign('user_id', 'pilot_feedback_user_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table
        .foreign(['organization_id', 'tenant_id'], 'pilot_feedback_organization_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('organizations')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['establishment_id', 'tenant_id', 'organization_id'],
          'pilot_feedback_establishment_tenant_organization_foreign'
        )
        .references(['id', 'tenant_id', 'organization_id'])
        .inTable('establishments')
        .onDelete('RESTRICT')
      table
        .foreign('reviewed_by', 'pilot_feedback_reviewed_by_foreign')
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')

      table.check(
        "context IN ('general', 'onboarding', 'organization', 'establishment', 'catalog', 'analytics', 'moderation')",
        [],
        'pilot_feedback_context_check'
      )
      table.check('rating BETWEEN 1 AND 5', [], 'pilot_feedback_rating_check')
      table.check(
        'char_length(btrim(message)) BETWEEN 3 AND 4000',
        [],
        'pilot_feedback_message_check'
      )
      table.check(
        "status IN ('new', 'in_review', 'resolved', 'dismissed')",
        [],
        'pilot_feedback_status_check'
      )
      table.check(
        `(
          status = 'new'
          AND reviewed_by IS NULL
          AND reviewed_at IS NULL
        ) OR (
          status IN ('in_review', 'resolved', 'dismissed')
          AND reviewed_by IS NOT NULL
          AND reviewed_at IS NOT NULL
        )`,
        [],
        'pilot_feedback_review_state_check'
      )
      table.check(
        'internal_notes IS NULL OR char_length(btrim(internal_notes)) BETWEEN 1 AND 4000',
        [],
        'pilot_feedback_internal_notes_check'
      )
      table.check(
        'establishment_id IS NULL OR organization_id IS NOT NULL',
        [],
        'pilot_feedback_establishment_requires_organization_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
