import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * ADR-0027 §7: the public average and count come from the projection, never
 * from a live query.
 *
 * Kept as a narrow function of its own rather than folded into
 * `catalog_refresh_establishment`: that function is six hundred lines that
 * rebuild the whole public row, and reproducing it to add two numbers would put
 * the rest of the catalogue at risk for no gain. The upsert there does not touch
 * these columns, so a revision being republished leaves the aggregates alone,
 * and the insert trigger fills them when the row is created from scratch.
 *
 * Nothing here is an incremental counter: every call recomputes from the
 * reviews themselves, so moderation hiding a review, or an author deleting one,
 * corrects the average retroactively — which is the reconstructibility the ADR
 * asks for.
 */
export default class extends BaseSchema {
  protected tableName = 'catalog_establishments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('reviews_count').unsigned().notNullable().defaultTo(0)
      // One decimal place is what a rating is ever read at. Storing more would
      // promise a precision the number does not have.
      table.decimal('reviews_average', 2, 1).nullable()
      table.check('reviews_count >= 0', [], 'catalog_establishments_reviews_count_check')
      table.check(
        'reviews_average IS NULL OR (reviews_average >= 1 AND reviews_average <= 5)',
        [],
        'catalog_establishments_reviews_average_check'
      )
    })

    this.defer(async (db) => {
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

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_reviews_from_review_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF TG_OP = 'DELETE' THEN
            PERFORM catalog_refresh_establishment_reviews(OLD.tenant_id, OLD.establishment_id);
            RETURN OLD;
          END IF;

          -- A review that moves between establishments is not a case the model
          -- allows, but correcting both sides costs nothing and keeps the
          -- aggregate honest if it ever does.
          IF TG_OP = 'UPDATE' AND OLD.establishment_id IS DISTINCT FROM NEW.establishment_id THEN
            PERFORM catalog_refresh_establishment_reviews(OLD.tenant_id, OLD.establishment_id);
          END IF;

          PERFORM catalog_refresh_establishment_reviews(NEW.tenant_id, NEW.establishment_id);
          RETURN NEW;
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE TRIGGER establishment_reviews_catalog_aggregate_trigger
        AFTER INSERT OR UPDATE OR DELETE ON establishment_reviews
        FOR EACH ROW
        EXECUTE FUNCTION catalog_refresh_reviews_from_review_trigger()
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_fill_reviews_on_projection_insert()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          PERFORM catalog_refresh_establishment_reviews(NEW.tenant_id, NEW.establishment_id);
          RETURN NULL;
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE TRIGGER catalog_establishments_reviews_fill_trigger
        AFTER INSERT ON catalog_establishments
        FOR EACH ROW
        EXECUTE FUNCTION catalog_fill_reviews_on_projection_insert()
      `)

      // Existing rows predate the trigger and would otherwise report zero
      // reviews until someone wrote one.
      await db.rawQuery(`
        UPDATE catalog_establishments AS projection
           SET reviews_count = aggregate.total,
               reviews_average = aggregate.mean
          FROM (
            SELECT tenant_id,
                   establishment_id,
                   count(*) AS total,
                   round(avg(rating)::numeric, 1) AS mean
              FROM establishment_reviews
             WHERE status = 'published'
             GROUP BY tenant_id, establishment_id
          ) AS aggregate
         WHERE projection.tenant_id = aggregate.tenant_id
           AND projection.establishment_id = aggregate.establishment_id
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        'DROP TRIGGER IF EXISTS catalog_establishments_reviews_fill_trigger ON catalog_establishments'
      )
      await db.rawQuery(
        'DROP TRIGGER IF EXISTS establishment_reviews_catalog_aggregate_trigger ON establishment_reviews'
      )
      await db.rawQuery('DROP FUNCTION IF EXISTS catalog_fill_reviews_on_projection_insert()')
      await db.rawQuery('DROP FUNCTION IF EXISTS catalog_refresh_reviews_from_review_trigger()')
      await db.rawQuery(
        'DROP FUNCTION IF EXISTS catalog_refresh_establishment_reviews(integer, integer)'
      )
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks([
        'catalog_establishments_reviews_average_check',
        'catalog_establishments_reviews_count_check',
      ])
      table.dropColumn('reviews_average')
      table.dropColumn('reviews_count')
    })
  }
}
