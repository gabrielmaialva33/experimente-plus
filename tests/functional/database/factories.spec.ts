import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'

import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'

test.group('Domain factories', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a complete benefit flow without crossing tenant boundaries', async ({ assert }) => {
    const scenario = await createBenefitFlowScenario({
      suffix: 'complete',
      withRedemption: true,
      maxRedemptionsPerAccess: 2,
    })
    const tenantId = scenario.tenant.id

    assert.equal(scenario.geography.region.tenant_id, tenantId)
    assert.equal(scenario.geography.city.tenant_id, tenantId)
    assert.equal(scenario.taxonomy.category.tenant_id, tenantId)
    assert.equal(scenario.organization.tenant_id, tenantId)
    assert.equal(scenario.membership.tenant_id, tenantId)
    assert.equal(scenario.establishment.tenant_id, tenantId)
    assert.equal(scenario.revision.tenant_id, tenantId)
    assert.equal(scenario.edition.tenant_id, tenantId)
    assert.equal(scenario.offer.tenant_id, tenantId)
    assert.equal(scenario.access.tenant_id, tenantId)
    assert.equal(scenario.redemption?.tenant_id, tenantId)

    assert.equal(scenario.organization.status, 'active')
    assert.equal(scenario.membership.role, 'owner')
    assert.equal(scenario.establishment.published_revision_id, scenario.revision.id)
    assert.equal(scenario.revision.status, 'approved')
    assert.equal(scenario.edition.status, 'published')
    assert.equal(scenario.offer.status, 'active')
    assert.equal(scenario.offer.max_redemptions_per_access, 2)
    assert.equal(scenario.access.status, 'active')
    assert.equal(scenario.redemption?.redemption_number, 1)
    assert.match(scenario.redemption!.receipt_code, /^EXP-[0-9A-F]{16}$/)
    const receiptColumn = await db.rawQuery<{
      rows: Array<{ character_maximum_length: number }>
    }>(
      `select character_maximum_length
       from information_schema.columns
       where table_schema = current_schema()
         and table_name = 'benefit_redemptions'
         and column_name = 'receipt_code'`
    )
    assert.equal(receiptColumn.rows[0]?.character_maximum_length, 20)
    const receiptConstraint = await db.rawQuery<{ rows: Array<{ definition: string }> }>(
      `select pg_get_constraintdef(oid) as definition
       from pg_constraint
       where conname = 'benefit_redemptions_receipt_code_format_check'
         and conrelid = 'benefit_redemptions'::regclass`
    )
    assert.include(receiptConstraint.rows[0]?.definition, '^EXP-[0-9A-F]{16}$')
    assert.equal(scenario.redemption?.offer_terms_snapshot, scenario.offer.terms)
    assert.equal(scenario.credentials.password, 'password123')

    await scenario.users.admin.load('roles')
    assert.include(
      scenario.users.admin.roles.map((role) => role.slug),
      'admin'
    )

    const outsiderMembership = await scenario.users.outsider
      .related('tenants')
      .query()
      .where('tenants.id', tenantId)
      .firstOrFail()
    assert.equal(outsiderMembership.$extras.pivot_role, 'member')
  })

  test('can create independent scenarios with no shared aggregate identifiers', async ({
    assert,
  }) => {
    const first = await createBenefitFlowScenario({ suffix: 'first' })
    const second = await createBenefitFlowScenario({ suffix: 'second' })

    assert.notEqual(first.tenant.id, second.tenant.id)
    assert.notEqual(first.organization.id, second.organization.id)
    assert.notEqual(first.establishment.id, second.establishment.id)
    assert.notEqual(first.edition.id, second.edition.id)
    assert.notEqual(first.access.id, second.access.id)
  })
})
