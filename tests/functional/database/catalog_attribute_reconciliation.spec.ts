import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import ReconcileCatalogAttributes from '#database/migrations/1788556800000_reconcile_catalog_attribute_slugs'
import {
  EstablishmentFactory,
  EstablishmentRevisionFactory,
} from '#database/factories/establishment_factory'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import { createEstablishmentScenario } from '#tests/functional/establishments/helpers'

const migrationName = 'catalog_attribute_reconciliation_test'

async function reconcile() {
  await db.transaction(async (trx) => {
    await new ReconcileCatalogAttributes(trx, migrationName).execUp()
  })
}

async function refreshDefinition() {
  const result = await db.rawQuery<{ rows: Array<{ definition: string }> }>(`
    SELECT pg_get_functiondef('catalog_refresh_establishment(integer, integer)'::regprocedure)
      AS definition
  `)
  return result.rows[0].definition
}

async function schemaContract() {
  const column = await db.rawQuery<{
    rows: Array<{ udt_name: string; is_nullable: string; column_default: string | null }>
  }>(`
    SELECT udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'catalog_establishments'
      AND column_name = 'attribute_slugs'
  `)
  const index = await db.rawQuery<{
    rows: Array<{ oid: string; definition: string; valid: boolean; ready: boolean }>
  }>(`
    SELECT indexrelid::text AS oid, pg_get_indexdef(indexrelid) AS definition,
      indisvalid AS valid, indisready AS ready
    FROM pg_index
    WHERE indexrelid = 'catalog_establishments_attribute_slugs_index'::regclass
      AND indrelid = 'catalog_establishments'::regclass
  `)
  return { column: column.rows[0], index: index.rows[0] }
}

async function createProjectionFixture(prefix: string, enabled = true) {
  const scenario = await createEstablishmentScenario(prefix)
  const establishment = await EstablishmentFactory.merge({
    tenant_id: scenario.tenant.id,
    organization_id: scenario.organization.id,
    created_by: scenario.owner.id,
  }).create()
  const revision = await EstablishmentRevisionFactory.apply('approved')
    .merge({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      slug: `${prefix}-${establishment.id}`,
      city_id: scenario.city.id,
      created_by: scenario.owner.id,
      reviewed_by: scenario.owner.id,
    })
    .create()
  const attribute = await EstablishmentRevisionAttributeValue.create({
    tenant_id: scenario.tenant.id,
    revision_id: revision.id,
    attribute_definition_id: scenario.inheritedBoolean.id,
    value_boolean: enabled,
  })
  establishment.published_revision_id = revision.id
  await establishment.save()

  const projection = () =>
    db.from('catalog_establishments').where('establishment_id', establishment.id).firstOrFail()
  return { scenario, establishment, revision, attribute, projection }
}

test.group('Catalog attribute schema reconciliation', (group) => {
  // All simulated historical DDL and fixtures are rolled back after each test.
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('repairs an applied legacy schema and refreshes every tenant from published sources', async ({
    assert,
  }) => {
    const first = await createProjectionFixture('catalog-upgrade-true')
    const second = await createProjectionFixture('catalog-upgrade-false', false)
    const canonicalFunction = await refreshDefinition()
    const initialProjection = await first.projection()

    await db
      .from('catalog_establishments')
      .where('establishment_id', second.establishment.id)
      .delete()
    await db.rawQuery('ALTER TABLE catalog_establishments DROP COLUMN attribute_slugs')
    // A previously installed function does not acquire new code from edited files.
    await db.rawQuery(`
      CREATE OR REPLACE FUNCTION catalog_refresh_establishment(
        p_tenant_id integer, p_establishment_id integer
      ) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$
    `)

    await reconcile()

    const contract = await schemaContract()
    assert.deepEqual(contract.column, {
      udt_name: '_text',
      is_nullable: 'NO',
      column_default: null,
    })
    assert.isTrue(contract.index.valid)
    assert.include(contract.index.definition, 'USING gin (attribute_slugs)')
    assert.equal(await refreshDefinition(), canonicalFunction)
    const firstProjection = await first.projection()
    const secondProjection = await second.projection()
    assert.deepEqual(firstProjection.attribute_slugs, [first.scenario.inheritedBoolean.key])
    assert.deepEqual(secondProjection.attribute_slugs, [])
    assert.isAbove(firstProjection.projection_version, initialProjection.projection_version)

    // Existing triggers must continue using the repaired function after rollout.
    first.attribute.value_boolean = false
    await first.attribute.save()
    const refreshedProjection = await first.projection()
    assert.deepEqual(refreshedProjection.attribute_slugs, [])
  })

  test('accepts the clean-install or hotfixed schema repeatedly and keeps the repair on down', async ({
    assert,
  }) => {
    const fixture = await createProjectionFixture('catalog-upgrade-idempotent')
    await db
      .from('catalog_establishments')
      .where('establishment_id', fixture.establishment.id)
      .update({ is_sponsored: true, sponsored_priority: 7 })
    const before = await fixture.projection()
    const canonicalFunction = await refreshDefinition()
    const canonicalSchema = await schemaContract()
    await fixture.revision.refresh()
    const source = fixture.revision.serialize()

    await reconcile()
    await reconcile()
    await new ReconcileCatalogAttributes(db.connection(), migrationName).execDown()

    const after = await fixture.projection()
    assert.deepEqual(await schemaContract(), canonicalSchema)
    assert.equal(await refreshDefinition(), canonicalFunction)
    assert.deepEqual(after.attribute_slugs, before.attribute_slugs)
    assert.deepEqual(after.public_attributes, before.public_attributes)
    assert.isTrue(after.is_sponsored)
    assert.equal(after.sponsored_priority, 7)
    await fixture.revision.refresh()
    assert.deepEqual(fixture.revision.serialize(), source)
  })

  test('finishes a partial repair without retaining an empty-array default or nullable data', async ({
    assert,
  }) => {
    const fixture = await createProjectionFixture('catalog-upgrade-partial')
    await db.rawQuery(`
      ALTER TABLE catalog_establishments
      ALTER COLUMN attribute_slugs DROP NOT NULL,
      ALTER COLUMN attribute_slugs SET DEFAULT ARRAY[]::text[]
    `)
    await db.rawQuery('DROP INDEX catalog_establishments_attribute_slugs_index')
    await db
      .from('catalog_establishments')
      .where('establishment_id', fixture.establishment.id)
      .update({ attribute_slugs: null })

    await reconcile()

    const contract = await schemaContract()
    assert.equal(contract.column.is_nullable, 'NO')
    assert.isNull(contract.column.column_default)
    assert.isTrue(contract.index.valid)
    const projection = await fixture.projection()
    assert.deepEqual(projection.attribute_slugs, [fixture.scenario.inheritedBoolean.key])
  })

  test('removes divergent uniqueness before rebuilding a missing projection', async ({
    assert,
  }) => {
    const first = await createProjectionFixture('catalog-upgrade-unique-first', false)
    const second = await createProjectionFixture('catalog-upgrade-unique-second', false)
    await db
      .from('catalog_establishments')
      .where('establishment_id', second.establishment.id)
      .delete()
    await db.rawQuery('DROP INDEX catalog_establishments_attribute_slugs_index')
    await db.rawQuery(`
      CREATE UNIQUE INDEX catalog_establishments_attribute_slugs_index
      ON catalog_establishments USING btree (attribute_slugs)
    `)

    await reconcile()

    const firstProjection = await first.projection()
    const secondProjection = await second.projection()
    assert.deepEqual(firstProjection.attribute_slugs, [])
    assert.deepEqual(secondProjection.attribute_slugs, [])
    const contract = await schemaContract()
    assert.include(contract.index.definition, 'USING gin (attribute_slugs)')
    assert.isTrue(contract.index.valid)
  })

  for (const type of ['varchar[]', 'varchar(120)[]']) {
    test(`refuses a homonymous ${type} column without casting or rebuilding data`, async ({
      assert,
    }) => {
      const fixture = await createProjectionFixture('catalog-upgrade-type')
      await db.rawQuery('DROP INDEX catalog_establishments_attribute_slugs_index')
      await db.rawQuery(`
        ALTER TABLE catalog_establishments ALTER COLUMN attribute_slugs TYPE ${type}
          USING attribute_slugs::${type}
      `)
      await db.rawQuery(`
        CREATE INDEX catalog_establishments_attribute_slugs_index
          ON catalog_establishments USING GIN (attribute_slugs)
      `)
      const before = await fixture.projection()
      const oldSchema = await schemaContract()
      const oldFunction = await refreshDefinition()

      await assert.rejects(
        reconcile,
        /Catalog reconciliation refused: attribute_slugs must be a plain text\[\] column/
      )

      assert.deepEqual(await schemaContract(), oldSchema)
      assert.equal(oldSchema.column.udt_name, '_varchar')
      assert.equal(await refreshDefinition(), oldFunction)
      assert.deepEqual(await fixture.projection(), before)
    })
  }

  for (const [name, definition] of [
    ['another column', 'USING GIN (category_slugs)'],
    ['another access method', 'USING btree (attribute_slugs)'],
    ['a partial index', 'USING GIN (attribute_slugs) WHERE is_discoverable'],
    ['an invalid index', null],
    ['an index not ready for writes', null],
  ] as const) {
    test(`replaces the namesake when it is ${name}`, async ({ assert }) => {
      const fixture = await createProjectionFixture('catalog-upgrade-index')
      const canonical = await schemaContract()
      if (definition) {
        await db.rawQuery('DROP INDEX catalog_establishments_attribute_slugs_index')
        await db.rawQuery(`
          CREATE INDEX catalog_establishments_attribute_slugs_index
          ON catalog_establishments ${definition}
        `)
      } else {
        // Test-only corruption, rolled back by the group transaction. Requires
        // the disposable test DB's PostgreSQL superuser (as configured in CI).
        const flag = name === 'an invalid index' ? 'indisvalid' : 'indisready'
        await db.rawQuery(`
          UPDATE pg_index SET ${flag} = false
          WHERE indexrelid = 'catalog_establishments_attribute_slugs_index'::regclass
        `)
      }
      const divergent = await schemaContract()

      await reconcile()

      const repaired = await schemaContract()
      assert.notEqual(repaired.index.oid, divergent.index.oid)
      assert.equal(repaired.index.definition, canonical.index.definition)
      assert.isTrue(repaired.index.valid)
      assert.isTrue(repaired.index.ready)
      const projection = await fixture.projection()
      assert.deepEqual(projection.attribute_slugs, [fixture.scenario.inheritedBoolean.key])
    })
  }
})
