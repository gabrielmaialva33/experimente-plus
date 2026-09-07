import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('purchase_settlements', (t) => {
      t.uuid('id').primary()
      t.integer('tenant_id').notNullable().references('id').inTable('tenants').onDelete('RESTRICT')
      t.uuid('purchase_id').nullable().references('id').inTable('purchases').onDelete('RESTRICT')
      t.string('provider', 32).notNullable()
      t.string('provider_account', 100).notNullable()
      t.string('provider_environment', 16).notNullable()
      t.string('provider_id', 150).notNullable()
      t.string('statement_reference', 150).notNullable()
      t.string('line_reference', 150).notNullable()
      t.string('request_hash', 64).notNullable()
      t.string('currency', 3).notNullable()
      t.integer('gross_cents').notNullable()
      t.integer('fee_cents').notNullable()
      t.integer('net_cents').notNullable()
      t.integer('refunded_cents').notNullable()
      t.timestamp('settled_at', { useTz: true }).notNullable()
      t.integer('recorded_by').notNullable().references('id').inTable('users').onDelete('RESTRICT')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique([
        'provider',
        'provider_account',
        'provider_environment',
        'statement_reference',
        'line_reference',
      ])
      t.check("currency = 'BRL' AND gross_cents >= 0 AND fee_cents >= 0 AND refunded_cents >= 0")
    })
    this.defer(async (db) => {
      await db.rawQuery(
        `CREATE TRIGGER purchase_settlements_immutable BEFORE UPDATE OR DELETE ON purchase_settlements FOR EACH ROW EXECUTE FUNCTION purchase_events_immutable()`
      )
      await db.rawQuery(`CREATE FUNCTION protect_purchase_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF (to_jsonb(NEW) - ARRAY['status','access_id','provider_id','payment_input','instructions','paid_at','checked_at','refunded_cents','issue','updated_at']) IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['status','access_id','provider_id','payment_input','instructions','paid_at','checked_at','refunded_cents','issue','updated_at']) THEN
          RAISE EXCEPTION 'Purchase commercial identity is immutable';
        END IF;
        IF OLD.access_id IS NOT NULL AND NEW.access_id IS DISTINCT FROM OLD.access_id THEN RAISE EXCEPTION 'Purchase access identity is immutable'; END IF;
        IF OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN RAISE EXCEPTION 'Purchase provider identity is immutable'; END IF;
        IF NEW.refunded_cents < OLD.refunded_cents THEN RAISE EXCEPTION 'Refunded money cannot decrease'; END IF;
        RETURN NEW;
      END; $$`)
      await db.rawQuery(
        `CREATE TRIGGER protect_purchase_identity BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION protect_purchase_identity()`
      )
      await db.rawQuery(`CREATE FUNCTION protect_purchased_benefit_terms() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE edition integer; BEGIN
        edition := CASE WHEN TG_TABLE_NAME = 'benefit_editions' THEN OLD.id ELSE OLD.edition_id END;
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
      await db.rawQuery(
        `CREATE TRIGGER protect_purchased_edition_terms BEFORE UPDATE ON benefit_editions FOR EACH ROW EXECUTE FUNCTION protect_purchased_benefit_terms()`
      )
      await db.rawQuery(
        `CREATE TRIGGER protect_purchased_offer_terms BEFORE UPDATE ON benefit_offers FOR EACH ROW EXECUTE FUNCTION protect_purchased_benefit_terms()`
      )
    })
  }
  async down() {
    throw new Error('Financial history is forward-only')
  }
}
