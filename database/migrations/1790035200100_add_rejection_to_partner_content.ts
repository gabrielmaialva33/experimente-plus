import { BaseSchema } from '@adonisjs/lucid/schema'

const TABLES = ['establishment_experiences', 'establishment_events', 'establishment_showcase_items']

/**
 * Why the moderation refused a version — ADR-0028, revision of 27/09/2026.
 *
 * A refusal used to return the item to a draft and say nothing: the partner saw
 * "Rascunho" and could not tell a refusal from an item never sent. The reason
 * and the moment now live on the item while the refusal is the current state,
 * and are cleared when the partner sends a new version. The history keeps every
 * refusal, with its reason, in `partner_content_events`.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      for (const table of TABLES) {
        await db.rawQuery(`
          ALTER TABLE ${table}
            ADD COLUMN rejection_reason text NULL,
            ADD COLUMN rejected_at timestamptz NULL,
            ADD CONSTRAINT ${table}_rejection_consistent_check
              CHECK ((rejection_reason IS NULL) = (rejected_at IS NULL)),
            ADD CONSTRAINT ${table}_rejection_reason_length_check
              CHECK (rejection_reason IS NULL OR char_length(rejection_reason) BETWEEN 3 AND 2000)
        `)
      }
    })
  }

  async down() {
    this.defer(async (db) => {
      for (const table of TABLES) {
        await db.rawQuery(`
          ALTER TABLE ${table}
            DROP CONSTRAINT IF EXISTS ${table}_rejection_reason_length_check,
            DROP CONSTRAINT IF EXISTS ${table}_rejection_consistent_check,
            DROP COLUMN IF EXISTS rejected_at,
            DROP COLUMN IF EXISTS rejection_reason
        `)
      }
    })
  }
}
