import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import { UserFactory } from '#database/factories/user_factory'
import ReconcileCredentialVersion from '#database/migrations/1788556800400_add_credential_version_to_users'

const migrationName = 'credential_version_reconciliation_test'
const constraintName = 'users_credential_version_positive_check'

type CredentialVersionContract = {
  column: {
    type_name: string
    not_null: boolean
    default_expression: string | null
  } | null
  constraints: Array<{
    constraint_type: string
    validated: boolean
    definition: string
    key_columns: string | null
  }>
}

async function reconcile() {
  await db.transaction(async (trx) => {
    await new ReconcileCredentialVersion(trx, migrationName).execUp()
  })
}

async function retainOnDown() {
  await new ReconcileCredentialVersion(db.connection(), migrationName).execDown()
}

async function removeCredentialVersionContract() {
  await db.rawQuery(`
    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS ${constraintName},
      DROP COLUMN IF EXISTS credential_version
  `)
}

async function contract(): Promise<CredentialVersionContract> {
  const column = await db.rawQuery<{
    rows: Array<{
      type_name: string
      not_null: boolean
      default_expression: string | null
    }>
  }>(`
    SELECT
      format_type(attribute_record.atttypid, attribute_record.atttypmod) AS type_name,
      attribute_record.attnotnull AS not_null,
      pg_get_expr(default_record.adbin, default_record.adrelid) AS default_expression
    FROM pg_attribute AS attribute_record
    LEFT JOIN pg_attrdef AS default_record
      ON default_record.adrelid = attribute_record.attrelid
      AND default_record.adnum = attribute_record.attnum
    WHERE attribute_record.attrelid = 'users'::regclass
      AND attribute_record.attname = 'credential_version'
      AND NOT attribute_record.attisdropped
  `)
  const constraints = await db.rawQuery<{
    rows: CredentialVersionContract['constraints']
  }>(`
    SELECT
      constraint_record.contype AS constraint_type,
      constraint_record.convalidated AS validated,
      pg_get_constraintdef(constraint_record.oid) AS definition,
      constraint_record.conkey::text AS key_columns
    FROM pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'users'::regclass
      AND constraint_record.conname = '${constraintName}'
  `)

  return { column: column.rows[0] ?? null, constraints: constraints.rows }
}

async function createUser(label: string) {
  const suffix = randomUUID()
  const safeLabel = label.replaceAll(' ', '-').slice(0, 32)
  return UserFactory.merge({
    email: `credential-version-${safeLabel}-${suffix}@example.test`,
    username: `cv-${safeLabel}-${suffix.slice(0, 16)}`,
  }).create()
}

async function identitySnapshot(userId: number) {
  return db
    .from('users')
    .where('id', userId)
    .select(
      'id',
      'full_name',
      'email',
      'username',
      'password',
      'is_deleted',
      'metadata',
      'created_at',
      'updated_at'
    )
    .firstOrFail()
}

async function storedVersion(userId: number): Promise<number | null> {
  const row = await db.from('users').where('id', userId).select('credential_version').firstOrFail()
  return row.credential_version === null ? null : Number(row.credential_version)
}

test.group('Credential version schema reconciliation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('installs the missing legacy/fresh column without rewriting existing user data', async ({
    assert,
  }) => {
    const user = await createUser('missing')
    const before = await identitySnapshot(user.id)
    await removeCredentialVersionContract()

    await reconcile()
    const repaired = await contract()

    assert.deepEqual(await identitySnapshot(user.id), before)
    assert.equal(await storedVersion(user.id), 1)
    assert.deepEqual(repaired.column, {
      type_name: 'integer',
      not_null: true,
      default_expression: '1',
    })
    assert.lengthOf(repaired.constraints, 1)
    assert.equal(repaired.constraints[0].constraint_type, 'c')
    assert.isTrue(repaired.constraints[0].validated)
    assert.include(repaired.constraints[0].definition, 'credential_version > 0')
  })

  test('keeps a canonical fresh schema and higher generations across down and reapply', async ({
    assert,
  }) => {
    const user = await createUser('canonical')
    await db.from('users').where('id', user.id).update({ credential_version: 37 })
    const canonical = await contract()

    await reconcile()
    await retainOnDown()
    assert.deepEqual(await contract(), canonical)
    assert.equal(await storedVersion(user.id), 37)

    await reconcile()
    assert.deepEqual(await contract(), canonical)
    assert.equal(await storedVersion(user.id), 37)
  })

  test('repairs a compatible manual hotfix without reducing existing generations', async ({
    assert,
  }) => {
    const user = await createUser('hotfix')
    await db.from('users').where('id', user.id).update({ credential_version: 19 })
    await db.rawQuery(`
      ALTER TABLE users
        DROP CONSTRAINT IF EXISTS ${constraintName},
        ALTER COLUMN credential_version DROP NOT NULL,
        ALTER COLUMN credential_version SET DEFAULT 9;
      ALTER TABLE users
        ADD CONSTRAINT ${constraintName}
        CHECK (credential_version >= 1) NOT VALID
    `)

    await reconcile()
    const repaired = await contract()

    assert.equal(await storedVersion(user.id), 19)
    assert.deepEqual(repaired.column, {
      type_name: 'integer',
      not_null: true,
      default_expression: '1',
    })
    assert.lengthOf(repaired.constraints, 1)
    assert.equal(repaired.constraints[0].constraint_type, 'c')
    assert.isTrue(repaired.constraints[0].validated)
    assert.include(repaired.constraints[0].definition, 'credential_version > 0')
    assert.notInclude(repaired.constraints[0].definition, '>= 1')
  })

  for (const [label, invalidVersion] of [
    ['zero', 0],
    ['null', null],
  ] as const) {
    test(`refuses ${label} hotfix data without normalizing the stored generation`, async ({
      assert,
    }) => {
      const user = await createUser(`invalid-${label}`)
      await db.rawQuery(`
        ALTER TABLE users
          DROP CONSTRAINT IF EXISTS ${constraintName},
          ALTER COLUMN credential_version DROP NOT NULL,
          ALTER COLUMN credential_version DROP DEFAULT
      `)
      await db.from('users').where('id', user.id).update({ credential_version: invalidVersion })
      const before = await contract()

      await assert.rejects(
        reconcile,
        /Credential version reconciliation refused: existing versions violate the canonical contract/
      )

      assert.deepEqual(await contract(), before)
      assert.equal(await storedVersion(user.id), invalidVersion)
    })
  }

  test('refuses an incompatible column type and preserves its value and schema', async ({
    assert,
  }) => {
    const user = await createUser('wrong-type')
    await db.from('users').where('id', user.id).update({ credential_version: 23 })
    await db.rawQuery(`
      ALTER TABLE users
        DROP CONSTRAINT IF EXISTS ${constraintName},
        ALTER COLUMN credential_version DROP DEFAULT,
        ALTER COLUMN credential_version TYPE bigint USING credential_version::bigint
    `)
    const before = await contract()

    await assert.rejects(
      reconcile,
      /Credential version reconciliation refused: unexpected credential_version type/
    )

    assert.deepEqual(await contract(), before)
    assert.equal(await storedVersion(user.id), 23)
    assert.equal(before.column?.type_name, 'bigint')
  })

  for (const scenario of [
    {
      label: 'generated',
      definition: 'integer GENERATED ALWAYS AS (1) STORED',
    },
    {
      label: 'identity',
      definition: 'integer GENERATED BY DEFAULT AS IDENTITY',
    },
  ]) {
    test(`refuses a ${scenario.label} credential generation without rewriting it`, async ({
      assert,
    }) => {
      const user = await createUser(`wrong-${scenario.label}`)
      await db.rawQuery(`
        ALTER TABLE users
          DROP CONSTRAINT IF EXISTS ${constraintName},
          DROP COLUMN credential_version;
        ALTER TABLE users
          ADD COLUMN credential_version ${scenario.definition}
      `)
      const before = await contract()
      const versionBefore = await storedVersion(user.id)

      await assert.rejects(
        reconcile,
        /Credential version reconciliation refused: unexpected credential_version type/
      )

      assert.deepEqual(await contract(), before)
      assert.equal(await storedVersion(user.id), versionBefore)
    })
  }

  for (const scenario of [
    {
      label: 'non-check',
      install: `ALTER TABLE users ADD CONSTRAINT ${constraintName} UNIQUE (id)`,
      error: /Credential version reconciliation refused: constraint name has an unexpected type/,
    },
    {
      label: 'wrong-column check',
      install: `ALTER TABLE users ADD CONSTRAINT ${constraintName} CHECK (id > 0)`,
      error: /Credential version reconciliation refused: constraint targets unexpected columns/,
    },
  ]) {
    test(`refuses an incompatible ${scenario.label} constraint without replacing it`, async ({
      assert,
    }) => {
      const user = await createUser(`constraint-${scenario.label}`)
      await db.from('users').where('id', user.id).update({ credential_version: 29 })
      await db.rawQuery(`ALTER TABLE users DROP CONSTRAINT IF EXISTS ${constraintName}`)
      await db.rawQuery(scenario.install)
      const before = await contract()

      await assert.rejects(reconcile, scenario.error)

      assert.deepEqual(await contract(), before)
      assert.equal(await storedVersion(user.id), 29)
    })
  }
})
