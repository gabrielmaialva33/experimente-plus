import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

function refreshSnapshot(source) {
  const marker =
    '      await db.rawQuery(`\n        CREATE OR REPLACE FUNCTION catalog_refresh_establishment('
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, 'refresh function snapshot must exist')
  assert.equal(source.indexOf(marker, start + marker.length), -1, 'snapshot must be unique')
  const end = source.indexOf('\n      `)', start)
  assert.notEqual(end, -1, 'snapshot must include the complete SQL statement')
  return source.slice(start, end + '\n      `)'.length)
}

test('forward refresh SQL is byte-identical to the create migration and pinned baseline', async () => {
  // Read source only: no migration imports, Adonis bootstrap, SQL execution or DB.
  const [create, repair] = await Promise.all([
    readFile(
      new URL(
        '../../database/migrations/1782133990000_create_catalog_projection.ts',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../../database/migrations/1788556800000_reconcile_catalog_attribute_slugs.ts',
        import.meta.url
      ),
      'utf8'
    ),
  ])
  const expected = refreshSnapshot(create)
  assert.equal(refreshSnapshot(repair), expected)
  // Independently pins d71f93c so changing both copies cannot make the test pass.
  assert.equal(
    createHash('sha256').update(expected).digest('hex'),
    '402ff3ade15e2e53537664c52b7e2030b2bc2996bdeafc80025e18d7c495dd86'
  )
})

test('repair locks tenant version writers before touching the projection, with bounded waits', async () => {
  const source = await readFile(
    new URL(
      '../../database/migrations/1788556800000_reconcile_catalog_attribute_slugs.ts',
      import.meta.url
    ),
    'utf8'
  )
  const statements = [...source.matchAll(/await db\.rawQuery\((['"`])([\s\S]*?)\1\)/g)].map(
    (match) => match[2]
  )
  assert.deepEqual(statements.slice(0, 4), [
    "SET LOCAL lock_timeout = '5s'",
    "SET LOCAL statement_timeout = '60s'",
    'LOCK TABLE catalog_tenant_versions IN SHARE ROW EXCLUSIVE MODE',
    'LOCK TABLE catalog_establishments IN ACCESS EXCLUSIVE MODE NOWAIT',
  ])
  assert.match(statements[4], /^\s*ALTER TABLE catalog_establishments/)
  const refresh = refreshSnapshot(source)
  const bump = refresh.indexOf('catalog_bump_tenant_version(')
  const insert = refresh.indexOf('INSERT INTO catalog_establishments')
  assert.ok(bump >= 0, 'eligible refresh must call catalog_bump_tenant_version')
  assert.ok(insert >= 0, 'eligible refresh must insert into the projection')
  assert.ok(bump < insert)
})
