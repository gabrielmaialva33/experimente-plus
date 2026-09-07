import { BaseSchema } from '@adonisjs/lucid/schema'

/** Forward repair: a trigger record has only the columns of its own table. */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`CREATE OR REPLACE FUNCTION protect_purchased_benefit_terms() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE edition integer; BEGIN
        IF TG_TABLE_NAME = 'benefit_editions' THEN edition := OLD.id; ELSE edition := OLD.edition_id; END IF;
        PERFORM id FROM benefit_editions WHERE id = edition FOR UPDATE;
        IF EXISTS(SELECT 1 FROM purchases p WHERE p.edition_id = edition AND p.status IN ('pending','paid','review')) THEN
          IF TG_TABLE_NAME = 'benefit_editions' THEN
            IF ROW(NEW.usage_starts_at,NEW.usage_ends_at,NEW.city_id) IS DISTINCT FROM ROW(OLD.usage_starts_at,OLD.usage_ends_at,OLD.city_id) THEN RAISE EXCEPTION 'Purchased validity requires compensation before changing'; END IF;
          ELSE
            IF (to_jsonb(NEW) - ARRAY['status','activated_at','archived_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','activated_at','archived_at','updated_at']) THEN RAISE EXCEPTION 'Purchased offer terms require compensation before changing'; END IF;
          END IF;
        END IF;
        RETURN NEW;
      END; $$`)
    })
  }
  async down() {
    throw new Error('Financial history is forward-only')
  }
}
