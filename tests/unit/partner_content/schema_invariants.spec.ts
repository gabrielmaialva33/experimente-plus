import { readdir } from 'node:fs/promises'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'

const contents = [
  ['establishment_experiences', '1789516800100'],
  ['establishment_events', '1789516800200'],
  ['establishment_showcase_items', '1789516800300'],
] as const

async function migrationSql(table: string, timestamp: string, direction: 'up' | 'down' = 'up') {
  const file = `${timestamp}_create_${table}_table`
  const { default: Migration } = await import(`#database/migrations/${file}`)
  const migration = new Migration(db.connection(), file, true)
  const queries = await (direction === 'up' ? migration.execUp() : migration.execDown())
  return (queries as string[]).join('\n')
}

test.group('Partner content schema (ADR-0028)', () => {
  test('introduces separate content aggregates and one tenant policy', async ({ assert }) => {
    const migrations = await readdir(app.makePath('database/migrations'))
    for (const table of [
      'establishment_experiences',
      'establishment_events',
      'establishment_showcase_items',
      'partner_content_policies',
    ]) {
      assert.isTrue(
        migrations.some((file) => file.endsWith(`_create_${table}_table.ts`)),
        `Missing migration for ${table}`
      )
    }
  })

  for (const [table, timestamp] of contents) {
    test(`${table}: stable identity, tenant-safe ownership and no revision dependency`, async ({
      assert,
    }) => {
      const sql = await migrationSql(table, timestamp)
      assert.include(sql, '"id" serial primary key')
      assert.include(sql, `constraint "${table}_id_tenant_unique" unique ("id", "tenant_id")`)
      assert.include(
        sql,
        'foreign key ("establishment_id", "tenant_id") references "establishments" ("id", "tenant_id") on delete RESTRICT'
      )
      assert.include(
        sql,
        'foreign key ("created_by", "tenant_id") references "user_tenants" ("user_id", "tenant_id") on delete RESTRICT'
      )
      assert.notInclude(sql, 'establishment_revisions')
      assert.notInclude(sql, 'revision_id')
      assert.notInclude(sql, 'CASCADE')
    })

    test(`${table}: independent state, approved snapshot and retained archive`, async ({
      assert,
    }) => {
      const sql = await migrationSql(table, timestamp)
      assert.include(sql, '"status" varchar(24) not null default \'draft\'')
      assert.include(sql, "status IN ('draft', 'pending_review', 'published', 'archived')")
      assert.include(sql, '"published_snapshot" jsonb null')
      assert.include(
        sql,
        "published_snapshot IS NULL OR jsonb_typeof(published_snapshot) = 'object'"
      )
      assert.include(sql, '"archived_at" timestamptz null')
      assert.include(sql, '"archived_by" integer null')
      assert.include(sql, '(published_snapshot IS NULL) = (published_at IS NULL)')
      assert.include(sql, "status <> 'published' OR published_snapshot IS NOT NULL")
      assert.include(
        sql,
        "status = 'archived' AND archived_at IS NOT NULL AND archived_by IS NOT NULL"
      )
      assert.include(sql, "status <> 'archived' AND archived_at IS NULL AND archived_by IS NULL")
      assert.include(
        sql,
        'foreign key ("archived_by") references "users" ("id") on delete RESTRICT'
      )
      assert.include(sql, `CREATE TRIGGER ${table}_prevent_delete`)
      assert.include(sql, `BEFORE DELETE ON ${table}`)
      assert.include(sql, "RAISE EXCEPTION 'Partner content must be archived, never deleted'")
      assert.include(sql, '"created_at" timestamptz not null')
      assert.include(sql, '"updated_at" timestamptz not null')
    })

    test(`${table}: rollback removes its deletion guard`, async ({ assert }) => {
      const sql = await migrationSql(table, timestamp, 'down')
      assert.include(sql, `drop table "${table}"`)
      assert.include(sql, `DROP FUNCTION IF EXISTS prevent_${table}_deletion()`)
    })
  }

  test('only events require an ordered timezone-aware window', async ({ assert }) => {
    const sql = await migrationSql('establishment_events', '1789516800200')
    assert.include(sql, '"starts_at" timestamptz not null')
    assert.include(sql, '"ends_at" timestamptz not null')
    assert.include(sql, 'ends_at > starts_at')
    for (const [table, timestamp] of [contents[0], contents[2]]) {
      const timelessSql = await migrationSql(table, timestamp)
      assert.notInclude(timelessSql, 'starts_at')
      assert.notInclude(timelessSql, 'ends_at')
    }
  })

  test('showcase price is optional integer cents without commerce relationships', async ({
    assert,
  }) => {
    const sql = await migrationSql('establishment_showcase_items', '1789516800300')
    assert.include(sql, '"informational_price_cents" integer null')
    assert.include(sql, 'informational_price_cents >= 0')
    for (const term of ['benefit_offers', 'purchases', 'orders', 'stock', 'checkout', 'cart']) {
      assert.notInclude(sql, term)
    }
  })

  test('one policy per tenant with the five proposed defaults and nonnegative limits', async ({
    assert,
  }) => {
    const sql = await migrationSql('partner_content_policies', '1789516800000')
    assert.include(sql, '"id" serial primary key')
    assert.include(
      sql,
      'constraint "partner_content_policies_id_tenant_unique" unique ("id", "tenant_id")'
    )
    assert.include(sql, 'constraint "partner_content_policies_tenant_unique" unique ("tenant_id")')
    for (const [name, defaultValue] of [
      ['require_experience_approval', "boolean not null default '0'"],
      ['require_event_approval', "boolean not null default '1'"],
      ['require_showcase_item_approval', "boolean not null default '0'"],
      ['max_media_per_content', "integer not null default '6'"],
      ['min_event_notice_minutes', "integer not null default '0'"],
    ]) {
      assert.include(sql, `"${name}" ${defaultValue}`)
    }
    assert.include(sql, 'max_media_per_content >= 0')
    assert.include(sql, 'min_event_notice_minutes >= 0')
  })
})
