import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The origin of an anonymous report is unique per target — ADR-0027 scenario 14.
 *
 * The token hash already had its partial unique index; the address hash had
 * none, because nothing wrote it until anonymous reports existed. Without it
 * two submissions from the same connection racing past the service's lookup
 * would both be stored. With it they meet in the database and the loser is
 * answered as a repeat.
 *
 * The consequence is stated rather than hidden: people behind the same address
 * — a shared network, a carrier's NAT — cannot report the same thing twice
 * anonymously. They can still report it with an account.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE UNIQUE INDEX content_reports_anonymous_origin_unique
          ON content_reports(tenant_id, target_type, target_id, reporter_ip_hash)
        WHERE reporter_id IS NULL AND reporter_ip_hash IS NOT NULL
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS content_reports_anonymous_origin_unique')
    })
  }
}
