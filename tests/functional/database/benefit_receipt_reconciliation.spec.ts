import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import ReconcileReceiptCodes from '#database/migrations/1788556800100_reconcile_benefit_receipt_codes'
import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'

const migrationName = 'benefit_receipt_reconciliation_test'
const validCode = 'EXP-0123456789ABCDEF'

async function reconcile() {
  await db.transaction(async (trx) => {
    await new ReconcileReceiptCodes(trx, migrationName).execUp()
  })
}

async function legacySchema() {
  await db.rawQuery(`
    ALTER TABLE benefit_redemptions
      DROP CONSTRAINT IF EXISTS benefit_redemptions_receipt_code_format_check,
      ALTER COLUMN receipt_code TYPE varchar(24)
  `)
}

async function contract() {
  const column = await db.rawQuery<{
    rows: Array<{ character_maximum_length: number; is_nullable: string }>
  }>(`
    SELECT character_maximum_length, is_nullable FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'benefit_redemptions'
      AND column_name = 'receipt_code'
  `)
  const check = await db.rawQuery<{
    rows: Array<{ validated: boolean; definition: string }>
  }>(`
    SELECT convalidated AS validated, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid = 'benefit_redemptions'::regclass
      AND conname = 'benefit_redemptions_receipt_code_format_check'
  `)
  return { column: column.rows[0], checks: check.rows }
}

async function receiptFixture(suffix: string) {
  const scenario = await createBenefitFlowScenario({ suffix, withRedemption: true })
  const id = scenario.redemption!.id
  await db.from('benefit_redemptions').where('id', id).update({ receipt_code: validCode })
  return { id, row: () => db.from('benefit_redemptions').where('id', id).firstOrFail() }
}

test.group('Benefit receipt schema reconciliation', (group) => {
  // Historical DDL and synthetic data stay inside the disposable test transaction.
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('repairs varchar(24) without changing valid receipts and retains the repair on down', async ({
    assert,
  }) => {
    const fixture = await receiptFixture('receipt-forward')
    const before = await fixture.row()
    await legacySchema()

    await reconcile()
    await reconcile()
    await new ReconcileReceiptCodes(db.connection(), migrationName).execDown()

    const schema = await contract()
    assert.deepEqual(schema.column, { character_maximum_length: 20, is_nullable: 'NO' })
    assert.lengthOf(schema.checks, 1)
    assert.isTrue(schema.checks[0].validated)
    assert.include(schema.checks[0].definition, '^EXP-[0-9A-F]{16}$')
    assert.deepEqual(await fixture.row(), before)
  })

  test('accepts an empty legacy table and the already canonical schema', async ({ assert }) => {
    // Test fixtures only; the production migration never deletes receipts.
    await db.from('benefit_redemptions').delete()
    await legacySchema()
    await reconcile()
    const canonical = await contract()
    await reconcile()
    assert.deepEqual(await contract(), canonical)
    assert.equal(canonical.column.character_maximum_length, 20)
    assert.isTrue(canonical.checks[0].validated)
    assert.lengthOf(await db.from('benefit_redemptions'), 0)
  })

  for (const [label, code] of [
    ['oversized', `${validCode}ABCD`],
    ['trailing-spaces', `${validCode}    `],
    ['invalid-format', 'EXP-0123456789abcdef'],
    ['null', null],
  ] as const) {
    test(`refuses ${label} receipts before narrowing and preserves the legacy value`, async ({
      assert,
    }) => {
      const fixture = await receiptFixture(`receipt-${label}`)
      await legacySchema()
      if (code === null) {
        await db.rawQuery('ALTER TABLE benefit_redemptions ALTER COLUMN receipt_code DROP NOT NULL')
      }
      await db.from('benefit_redemptions').where('id', fixture.id).update({ receipt_code: code })
      const before = await fixture.row()
      const oldContract = await contract()

      await assert.rejects(
        reconcile,
        /Receipt reconciliation refused: existing codes violate the canonical format/
      )

      assert.deepEqual(await fixture.row(), before)
      assert.deepEqual(await contract(), oldContract)
      assert.equal(oldContract.column.character_maximum_length, 24)
      assert.lengthOf(oldContract.checks, 0)
    })
  }

  test('replaces a weak unvalidated homonymous check and enforces the exact format', async ({
    assert,
  }) => {
    const fixture = await receiptFixture('receipt-weak-check')
    await legacySchema()
    await db.rawQuery(`
      ALTER TABLE benefit_redemptions ADD CONSTRAINT benefit_redemptions_receipt_code_format_check
        CHECK (char_length(receipt_code) > 0) NOT VALID
    `)
    await reconcile()
    const repaired = await contract()
    assert.isTrue(repaired.checks[0].validated)
    await assert.rejects(
      () =>
        db.transaction(async (trx) => {
          await trx.from('benefit_redemptions').where('id', fixture.id).update({
            receipt_code: 'EXP-0123456789abcdef',
          })
        }),
      /benefit_redemptions_receipt_code_format_check/
    )
    const receipt = await fixture.row()
    assert.equal(receipt.receipt_code, validCode)
  })
})
