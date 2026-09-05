import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import ReconcileUserIdentities from '#database/migrations/1788556800200_reconcile_user_identity_checks'
import { UserFactory } from '#database/factories/user_factory'

const migrationName = 'user_identity_reconciliation_test'

async function reconcile() {
  await db.transaction(async (trx) => {
    await new ReconcileUserIdentities(trx, migrationName).execUp()
  })
}

async function legacySchema() {
  await db.rawQuery(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_lowercase_check,
      DROP CONSTRAINT IF EXISTS users_username_canonical_check
  `)
}

async function checks() {
  const result = await db.rawQuery<{
    rows: Array<{ name: string; validated: boolean; definition: string }>
  }>(`
    SELECT conname AS name, convalidated AS validated, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid = 'users'::regclass
      AND conname IN ('users_email_lowercase_check', 'users_username_canonical_check')
    ORDER BY conname
  `)
  return result.rows
}

test.group('User identity schema reconciliation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('installs missing checks without rewriting identities, including null usernames', async ({
    assert,
  }) => {
    await UserFactory.merge({
      email: 'identity.named@example.test',
      username: 'identity.named-1',
    }).create()
    await UserFactory.merge({ email: 'identity.null@example.test', username: null }).create()
    const before = await db.from('users').orderBy('id')
    await legacySchema()

    await reconcile()
    const repaired = await checks()
    await reconcile()
    await new ReconcileUserIdentities(db.connection(), migrationName).execDown()

    assert.deepEqual(await db.from('users').orderBy('id'), before)
    assert.deepEqual(await checks(), repaired)
    assert.deepEqual(
      repaired.map((check) => check.name),
      ['users_email_lowercase_check', 'users_username_canonical_check']
    )
    assert.isTrue(repaired.every((check) => check.validated))
    assert.include(repaired[0].definition, 'lower(')
    assert.include(repaired[1].definition, '^[a-z0-9][a-z0-9._-]*$')
  })

  for (const [label, field, value] of [
    ['uppercase-email', 'email', 'Legacy.Email@example.test'],
    ['uppercase-username', 'username', 'LegacyUser'],
    ['invalid-username', 'username', '_legacy'],
    ['empty-username', 'username', ''],
  ] as const) {
    test(`refuses ${label} without normalization or partial constraints`, async ({ assert }) => {
      const user = await UserFactory.merge({
        email: 'identity.legacy@example.test',
        username: 'identity.legacy',
      }).create()
      await legacySchema()
      // Bypass the model's beforeSave canonicalization to reproduce stored drift.
      await db
        .from('users')
        .where('id', user.id)
        .update({ [field]: value })
      const before = await db.from('users').orderBy('id')

      await assert.rejects(
        reconcile,
        /User identity reconciliation refused: existing identities violate the canonical checks/
      )

      assert.deepEqual(await db.from('users').orderBy('id'), before)
      assert.lengthOf(await checks(), 0)
    })
  }

  test('replaces weak unvalidated checks and rejects raw writes that bypass the model', async ({
    assert,
  }) => {
    const user = await UserFactory.merge({
      email: 'identity.enforced@example.test',
      username: null,
    }).create()
    await legacySchema()
    await db.rawQuery(`
      ALTER TABLE users
        ADD CONSTRAINT users_email_lowercase_check CHECK (char_length(email) > 0) NOT VALID,
        ADD CONSTRAINT users_username_canonical_check CHECK (true) NOT VALID
    `)
    await reconcile()
    const repaired = await checks()
    assert.isTrue(repaired.every((check) => check.validated))

    for (const [field, value, constraint] of [
      ['email', 'UPPER@example.test', 'users_email_lowercase_check'],
      ['username', 'UPPER', 'users_username_canonical_check'],
      ['username', '_invalid', 'users_username_canonical_check'],
    ] as const) {
      await assert.rejects(
        () =>
          db.transaction(async (trx) => {
            await trx
              .from('users')
              .where('id', user.id)
              .update({ [field]: value })
          }),
        new RegExp(constraint)
      )
    }
    const preserved = await db.from('users').where('id', user.id).firstOrFail()
    assert.isNull(preserved.username)
  })
})
