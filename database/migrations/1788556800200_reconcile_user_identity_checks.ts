import { BaseSchema } from '@adonisjs/lucid/schema'

/** Install the canonical identity checks without rewriting existing identities. */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      if (!db.isTransaction) {
        throw new Error('User identity reconciliation requires transactional migrations')
      }
      await db.rawQuery("SET LOCAL lock_timeout = '5s'")
      await db.rawQuery("SET LOCAL statement_timeout = '60s'")
      await db.rawQuery('LOCK TABLE users IN ACCESS EXCLUSIVE MODE')
      await db.rawQuery(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM users
            WHERE email IS NULL OR email <> lower(email)
               OR (username IS NOT NULL AND (
                 username <> lower(username) OR username !~ '^[a-z0-9][a-z0-9._-]*$'
               ))
          ) THEN
            -- No email, username or row payload in the exception/log output.
            RAISE EXCEPTION 'User identity reconciliation refused: existing identities violate the canonical checks';
          END IF;
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'users'::regclass
              AND conname IN ('users_email_lowercase_check', 'users_username_canonical_check')
              AND contype <> 'c'
          ) THEN
            RAISE EXCEPTION 'User identity reconciliation refused: constraint name has an unexpected type';
          END IF;

          -- Replace even homonymous weak/unvalidated checks; do not assume that
          -- an existing name proves the contract. No UPDATE/normalization occurs.
          ALTER TABLE users
            DROP CONSTRAINT IF EXISTS users_email_lowercase_check,
            DROP CONSTRAINT IF EXISTS users_username_canonical_check;
          ALTER TABLE users
            ADD CONSTRAINT users_email_lowercase_check CHECK (email = lower(email)),
            ADD CONSTRAINT users_username_canonical_check CHECK (
              username IS NULL OR (
                username = lower(username) AND username ~ '^[a-z0-9][a-z0-9._-]*$'
              )
            );
        END;
        $$
      `)
    })
  }

  async down() {
    // Existing clean installs/hotfixes already own these checks. Retain them
    // across code rollback; the original users migration handles a full reset.
  }
}
