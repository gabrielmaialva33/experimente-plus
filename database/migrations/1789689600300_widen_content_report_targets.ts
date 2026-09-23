import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Partner content becomes reportable — ADR-0028, Anexo I item 9.
 *
 * ADR-0028 decided that the typed target of `content_reports` would admit
 * experiences, events and showcase items: that is why the queue was built
 * generic, and a second queue would contradict it. The decision was recorded
 * and never reached the table, whose check still allowed only the three
 * original targets.
 */
export default class extends BaseSchema {
  protected tableName = 'content_reports'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        'ALTER TABLE content_reports DROP CONSTRAINT content_reports_target_type_check'
      )
      await db.rawQuery(`
        ALTER TABLE content_reports
        ADD CONSTRAINT content_reports_target_type_check
        CHECK (target_type IN (
          'review', 'reply', 'establishment', 'experience', 'event', 'showcase_item'
        ))
      `)
    })
  }

  /**
   * Restoring the narrower check fails while reports of partner content exist,
   * which is the correct outcome: rolling back must not silently discard them.
   */
  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        'ALTER TABLE content_reports DROP CONSTRAINT content_reports_target_type_check'
      )
      await db.rawQuery(`
        ALTER TABLE content_reports
        ADD CONSTRAINT content_reports_target_type_check
        CHECK (target_type IN ('review', 'reply', 'establishment'))
      `)
    })
  }
}
