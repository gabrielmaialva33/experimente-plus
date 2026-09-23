import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Reports opened by a rule instead of a person — ADR-0031.
 *
 * Automatic moderation never decides alone: it opens a report in the single
 * queue of ADR-0027, with no reporter, the rule that fired and a masked piece
 * of evidence, and a person resolves it like any other.
 *
 * `holds_content` records that the rule kept the content out of public view.
 * It is what lets a human dismissal release exactly what the rule held and
 * nothing a moderator hid on their own judgement.
 *
 * The evidence is masked by the code that writes it. A rule that fires on a
 * card number must not copy the card number into the moderation queue.
 */
export default class extends BaseSchema {
  protected tableName = 'content_reports'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('origin', 16).notNullable().defaultTo('user')
      table.string('automatic_rule', 32).nullable()
      table.string('automatic_evidence', 200).nullable()
      table.boolean('holds_content').notNullable().defaultTo(false)

      table.check("origin IN ('user', 'automatic')", [], 'content_reports_origin_check')
      table.check(
        "automatic_rule IS NULL OR automatic_rule IN ('link', 'contact', 'payment_data', 'blocked_term')",
        [],
        'content_reports_automatic_rule_check'
      )
      // A rule report names its rule and has no human author; a person's report
      // names no rule.
      table.check(
        "(origin = 'automatic') = (automatic_rule IS NOT NULL)",
        [],
        'content_reports_automatic_rule_origin_check'
      )
      table.check(
        "origin = 'user' OR reporter_id IS NULL",
        [],
        'content_reports_automatic_reporter_check'
      )
      table.check(
        "holds_content = false OR origin = 'automatic'",
        [],
        'content_reports_holds_content_origin_check'
      )
    })

    this.defer(async (db) => {
      // One open automatic report per target: a second edit updates it instead
      // of stacking reports about the same text.
      await db.rawQuery(`
        CREATE UNIQUE INDEX content_reports_open_automatic_target_unique
          ON content_reports (tenant_id, target_type, target_id)
         WHERE origin = 'automatic' AND status IN ('pending', 'under_review')
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS content_reports_open_automatic_target_unique')
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks([
        'content_reports_origin_check',
        'content_reports_automatic_rule_check',
        'content_reports_automatic_rule_origin_check',
        'content_reports_automatic_reporter_check',
        'content_reports_holds_content_origin_check',
      ])
      table.dropColumn('holds_content')
      table.dropColumn('automatic_evidence')
      table.dropColumn('automatic_rule')
      table.dropColumn('origin')
    })
  }
}
