import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * ADR-0027, revision of 15/09/2026: a report carries a protocol its author can
 * follow up on, may be anonymous, records an anonymous author only as hashes,
 * and has a moderation deadline so an unanswered report stops being silent.
 *
 * Written forward rather than by amending the creating migration: at the time
 * of writing those had not reached homologation, but amending would depend on
 * winning that race, and a file that disagrees with an applied schema is the
 * failure mode this repository already documents.
 */
export default class extends BaseSchema {
  protected tableName = 'content_reports'

  async up() {
    this.schema.alterTable('review_policies', (table) => {
      table.integer('report_moderation_days').unsigned().notNullable().defaultTo(5)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.string('protocol_number', 24).nullable()
      table.boolean('is_anonymous').notNullable().defaultTo(false)
      // Origin and token of an anonymous author, hashed. The value in the clear
      // is never stored: these exist to recognise repetition, not the person.
      table.string('reporter_ip_hash', 64).nullable()
      table.string('reporter_token_hash', 64).nullable()
      table.integer('assigned_to').unsigned().nullable()
      table.timestamp('due_at', { useTz: true }).nullable()
      table.timestamp('sla_notified_at', { useTz: true }).nullable()

      table
        .foreign('assigned_to', 'content_reports_assigned_to_foreign')
        .references('id')
        .inTable('users')
    })

    this.defer(async (db) => {
      // Any row that predates the protocol gets one derived from its identity,
      // so the column can be required without inventing history.
      await db.rawQuery(
        `UPDATE content_reports
            SET protocol_number = 'DEN-' || to_char(created_at, 'YYYYMMDD') || '-' || lpad(id::text, 6, '0')
          WHERE protocol_number IS NULL`
      )
      await db.rawQuery(`ALTER TABLE content_reports ALTER COLUMN protocol_number SET NOT NULL`)
      // Anonymity requires an author-less row; the composite tenant foreign key
      // stays intact and simply does not apply when the column is null.
      await db.rawQuery(`ALTER TABLE content_reports ALTER COLUMN reporter_id DROP NOT NULL`)
      await db.rawQuery(
        `CREATE UNIQUE INDEX content_reports_protocol_unique ON content_reports(tenant_id, protocol_number)`
      )
      // The identified author is already unique per target by the existing
      // constraint, which a null author cannot enforce. The hash covers that
      // gap without ever learning who the author is.
      await db.rawQuery(
        `CREATE UNIQUE INDEX content_reports_anonymous_target_unique
           ON content_reports(tenant_id, target_type, target_id, reporter_token_hash)
         WHERE reporter_id IS NULL AND reporter_token_hash IS NOT NULL`
      )
      await db.rawQuery(
        `CREATE INDEX content_reports_due_pending_index
           ON content_reports(tenant_id, due_at)
         WHERE status = 'pending'`
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DROP INDEX IF EXISTS content_reports_due_pending_index`)
      await db.rawQuery(`DROP INDEX IF EXISTS content_reports_anonymous_target_unique`)
      await db.rawQuery(`DROP INDEX IF EXISTS content_reports_protocol_unique`)
      await db.rawQuery(`DELETE FROM content_reports WHERE reporter_id IS NULL`)
      await db.rawQuery(`ALTER TABLE content_reports ALTER COLUMN reporter_id SET NOT NULL`)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign('assigned_to', 'content_reports_assigned_to_foreign')
      table.dropColumn('sla_notified_at')
      table.dropColumn('due_at')
      table.dropColumn('assigned_to')
      table.dropColumn('reporter_token_hash')
      table.dropColumn('reporter_ip_hash')
      table.dropColumn('is_anonymous')
      table.dropColumn('protocol_number')
    })

    this.schema.alterTable('review_policies', (table) => {
      table.dropColumn('report_moderation_days')
    })
  }
}
