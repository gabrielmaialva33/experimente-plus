import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A ban, as ADR-0027 §6 decided it: the person's reviews leave public view and
 * the averages, and nothing is deleted.
 *
 * It lives on the membership, not on the user. A tenant is an isolated operation
 * (ADR-0001), and a moderator of one operation silencing someone in the
 * operation of a different business is not a decision that moderator has.
 *
 * Hiding is a read-time rule, never a rewrite of review status. That is the
 * decision this migration exists to make possible. If banning flipped reviews
 * to `hidden`, unbanning could not tell which of them were hidden by the ban
 * and which by a moderator acting on a report: restoring all would republish
 * content removed on its merits, restoring none would break scenario 7. With
 * the ban kept apart, a review is public when it is published *and* its author
 * is not banned, and the two causes never overwrite each other.
 */
export default class extends BaseSchema {
  protected tableName = 'user_tenants'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('banned_at', { useTz: true }).nullable()
      // Moderators are global users (ADR-0007); banning needs no membership.
      table
        .integer('banned_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.string('ban_reason', 500).nullable()

      // A ban always has an author and never outlives being lifted.
      table.check('(banned_at IS NULL) = (banned_by IS NULL)', [], 'user_tenants_ban_author_check')
      table.check(
        'banned_at IS NOT NULL OR ban_reason IS NULL',
        [],
        'user_tenants_ban_reason_check'
      )
    })

    this.defer(async (db) => {
      // The aggregate reads the same rule the public listing reads. Anything
      // else and the average would count reviews nobody can see.
      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_establishment_reviews(
          p_tenant_id integer,
          p_establishment_id integer
        )
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        DECLARE
          total integer := 0;
          mean numeric := NULL;
        BEGIN
          SELECT count(*), round(avg(review.rating)::numeric, 1)
            INTO total, mean
            FROM establishment_reviews review
           WHERE review.tenant_id = p_tenant_id
             AND review.establishment_id = p_establishment_id
             AND review.status = 'published'
             AND NOT EXISTS (
               SELECT 1
                 FROM user_tenants membership
                WHERE membership.user_id = review.user_id
                  AND membership.tenant_id = review.tenant_id
                  AND membership.banned_at IS NOT NULL
             );

          UPDATE catalog_establishments
             SET reviews_count = total,
                 reviews_average = mean,
                 updated_at = now()
           WHERE tenant_id = p_tenant_id
             AND establishment_id = p_establishment_id;
        END;
        $$
      `)

      // Banning and unbanning change every average the person contributed to,
      // retroactively. A trigger does it rather than the service, so that no
      // write path — a console, a repair script, a future admin screen — can
      // change a ban and leave the catalogue counting the wrong reviews.
      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION user_tenants_ban_refresh_reviews()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          reviewed record;
        BEGIN
          IF OLD.banned_at IS NOT DISTINCT FROM NEW.banned_at THEN
            RETURN NEW;
          END IF;

          FOR reviewed IN
            SELECT DISTINCT establishment_id
              FROM establishment_reviews
             WHERE tenant_id = NEW.tenant_id
               AND user_id = NEW.user_id
          LOOP
            PERFORM catalog_refresh_establishment_reviews(NEW.tenant_id, reviewed.establishment_id);
          END LOOP;

          RETURN NEW;
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE TRIGGER user_tenants_ban_refresh_reviews_trigger
        AFTER UPDATE OF banned_at ON user_tenants
        FOR EACH ROW
        EXECUTE FUNCTION user_tenants_ban_refresh_reviews()
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        'DROP TRIGGER IF EXISTS user_tenants_ban_refresh_reviews_trigger ON user_tenants'
      )
      await db.rawQuery('DROP FUNCTION IF EXISTS user_tenants_ban_refresh_reviews()')
      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_establishment_reviews(
          p_tenant_id integer,
          p_establishment_id integer
        )
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        DECLARE
          total integer := 0;
          mean numeric := NULL;
        BEGIN
          SELECT count(*), round(avg(rating)::numeric, 1)
            INTO total, mean
            FROM establishment_reviews
           WHERE tenant_id = p_tenant_id
             AND establishment_id = p_establishment_id
             AND status = 'published';

          UPDATE catalog_establishments
             SET reviews_count = total,
                 reviews_average = mean,
                 updated_at = now()
           WHERE tenant_id = p_tenant_id
             AND establishment_id = p_establishment_id;
        END;
        $$
      `)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks(['user_tenants_ban_author_check', 'user_tenants_ban_reason_check'])
      table.dropForeign(['banned_by'])
      table.dropColumn('banned_at')
      table.dropColumn('banned_by')
      table.dropColumn('ban_reason')
    })
  }
}
