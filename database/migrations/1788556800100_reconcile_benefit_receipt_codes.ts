import { BaseSchema } from '@adonisjs/lucid/schema'

/** Forward repair for the already applied varchar(24) receipt schema. */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      if (!db.isTransaction) {
        throw new Error('Receipt reconciliation requires transactional migrations')
      }
      await db.rawQuery("SET LOCAL lock_timeout = '5s'")
      await db.rawQuery("SET LOCAL statement_timeout = '60s'")
      await db.rawQuery('LOCK TABLE benefit_redemptions IN ACCESS EXCLUSIVE MODE')
      await db.rawQuery(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_attribute
            WHERE attrelid = 'benefit_redemptions'::regclass
              AND attname = 'receipt_code'
              AND atttypid = 'varchar'::regtype
              AND NOT attisdropped
          ) THEN
            RAISE EXCEPTION 'Receipt reconciliation refused: unexpected receipt_code type';
          END IF;

          -- Validate BEFORE narrowing: even excess trailing spaces can otherwise
          -- be truncated by PostgreSQL. Never cast, trim, regenerate or update codes.
          IF EXISTS (
            SELECT 1 FROM benefit_redemptions
            WHERE receipt_code IS NULL
               OR char_length(receipt_code) <> 20
               OR receipt_code !~ '^EXP-[0-9A-F]{16}$'
          ) THEN
            RAISE EXCEPTION 'Receipt reconciliation refused: existing codes violate the canonical format';
          END IF;
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'benefit_redemptions'::regclass
              AND conname = 'benefit_redemptions_receipt_code_format_check'
              AND contype <> 'c'
          ) THEN
            RAISE EXCEPTION 'Receipt reconciliation refused: constraint name has an unexpected type';
          END IF;

          -- Reinstall the named check, including weak or NOT VALID hotfixes.
          ALTER TABLE benefit_redemptions
            DROP CONSTRAINT IF EXISTS benefit_redemptions_receipt_code_format_check;
          IF EXISTS (
            SELECT 1 FROM pg_attribute
            WHERE attrelid = 'benefit_redemptions'::regclass
              AND attname = 'receipt_code'
              AND atttypmod <> 24
          ) THEN
            ALTER TABLE benefit_redemptions ALTER COLUMN receipt_code TYPE varchar(20);
          END IF;
          ALTER TABLE benefit_redemptions
            ALTER COLUMN receipt_code SET NOT NULL,
            ADD CONSTRAINT benefit_redemptions_receipt_code_format_check
              CHECK (receipt_code ~ '^EXP-[0-9A-F]{16}$');
        END;
        $$
      `)
    })
  }

  async down() {
    // Keep the canonical additive repair on code rollback; only a disposable
    // full reset removes it through create_benefit_redemptions_table.down().
  }
}
