import { BaseSchema } from '@adonisjs/lucid/schema'

/** Forward addition: unresolved/orphan notifications must not starve newer resources. */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('purchase_webhooks', (t) => {
      t.timestamp('checked_at', { useTz: true }).nullable()
      t.integer('attempts').notNullable().defaultTo(0)
      t.string('issue', 80).nullable()
    })
  }
  async down() {
    throw new Error('Financial history is forward-only')
  }
}
