import { BaseSchema } from '@adonisjs/lucid/schema'

/** Reconcile the durable JWT credential generation without ever reducing it. */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      if (!db.isTransaction) {
        throw new Error('Credential version reconciliation requires transactional migrations')
      }

      await db.rawQuery("SET LOCAL lock_timeout = '5s'")
      await db.rawQuery("SET LOCAL statement_timeout = '60s'")
      await db.rawQuery('LOCK TABLE users IN ACCESS EXCLUSIVE MODE')
      await db.rawQuery(`
        DO $$
        DECLARE
          credential_column_exists boolean;
        BEGIN
          SELECT EXISTS (
            SELECT 1
            FROM pg_attribute
            WHERE attrelid = 'users'::regclass
              AND attname = 'credential_version'
              AND NOT attisdropped
          ) INTO credential_column_exists;

          IF EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'users'::regclass
              AND conname = 'users_credential_version_positive_check'
              AND contype <> 'c'
          ) THEN
            RAISE EXCEPTION 'Credential version reconciliation refused: constraint name has an unexpected type';
          END IF;

          IF EXISTS (
            SELECT 1
            FROM pg_constraint AS constraint_record
            WHERE constraint_record.conrelid = 'users'::regclass
              AND constraint_record.conname = 'users_credential_version_positive_check'
              AND constraint_record.contype = 'c'
              AND (
                NOT credential_column_exists
                OR constraint_record.conkey IS DISTINCT FROM ARRAY[
                  (
                    SELECT attribute_record.attnum
                    FROM pg_attribute AS attribute_record
                    WHERE attribute_record.attrelid = 'users'::regclass
                      AND attribute_record.attname = 'credential_version'
                      AND NOT attribute_record.attisdropped
                  )
                ]::smallint[]
              )
          ) THEN
            RAISE EXCEPTION 'Credential version reconciliation refused: constraint targets unexpected columns';
          END IF;

          IF credential_column_exists THEN
            IF EXISTS (
              SELECT 1
              FROM pg_attribute
              WHERE attrelid = 'users'::regclass
                AND attname = 'credential_version'
                AND NOT attisdropped
                AND (
                  atttypid <> 'int4'::regtype
                  OR attgenerated <> ''
                  OR attidentity <> ''
                )
            ) THEN
              RAISE EXCEPTION 'Credential version reconciliation refused: unexpected credential_version type';
            END IF;

            -- Refuse invalid hotfix data instead of rewriting a security
            -- generation that may already have invalidated signed JWTs.
            IF EXISTS (
              SELECT 1
              FROM users
              WHERE credential_version IS NULL OR credential_version <= 0
            ) THEN
              RAISE EXCEPTION 'Credential version reconciliation refused: existing versions violate the canonical contract';
            END IF;
          ELSE
            ALTER TABLE users
              ADD COLUMN credential_version integer NOT NULL DEFAULT 1;
          END IF;

          -- A check constraint with the canonical name may be a weak or
          -- unvalidated manual hotfix. Reinstall it only after validating all
          -- values; no existing generation is updated or reset.
          ALTER TABLE users
            DROP CONSTRAINT IF EXISTS users_credential_version_positive_check;
          ALTER TABLE users
            ALTER COLUMN credential_version SET DEFAULT 1,
            ALTER COLUMN credential_version SET NOT NULL,
            ADD CONSTRAINT users_credential_version_positive_check
              CHECK (credential_version > 0);
        END;
        $$
      `)
    })
  }

  async down() {
    // Never remove or recreate this security generation on code rollback: a
    // reset to 1 could make a still-valid version-1 JWT authenticate again.
  }
}
