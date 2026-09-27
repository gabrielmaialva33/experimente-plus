import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'

import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'
import { createPublishedPlaceScenario } from '#database/factories/scenarios/published_place_factory'
import {
  CityFactory,
  EstablishmentFactory,
  EstablishmentRevisionAddressFactory,
  EstablishmentRevisionFactory,
  OrganizationFactory,
  UserFactory,
} from '#database/factories/index'
import { FIRST_NAMES, LONDRINA } from '#database/factories/support/pt_br'
import CnpjService from '#modules/organizations/services/cnpj_service'
import limiter from '@adonisjs/limiter/services/main'

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

  test('defaults read as pt-BR and pass the domain validations', async ({ assert }) => {
    const users = await UserFactory.createMany(5)
    for (const user of users) {
      assert.include(FIRST_NAMES as readonly string[], user.full_name.split(' ')[0])
      assert.match(user.email, /@example\.test$/)
    }
    assert.lengthOf(new Set(users.map((user) => user.email)), 5)

    const organization = await OrganizationFactory.make()
    assert.isTrue(new CnpjService().isValid(organization.tax_id))
    assert.match(organization.phone, /^43[2-5]\d{7}$/)
    assert.match(organization.legal_name, /Ltda\.$/)

    const revision = await EstablishmentRevisionFactory.apply('appointmentOnly').make()
    assert.equal(revision.availability_type, 'appointment_only')
    assert.match(revision.booking_url!, /^https:\/\/.+\.example\.test\/agendar$/)
    assert.match(revision.whatsapp!, /^439\d{8}$/)
    const returned = await EstablishmentRevisionFactory.apply('changesRequested').make()
    assert.equal(returned.status, 'changes_requested')
    const closed = await EstablishmentFactory.apply('temporarilyClosed').make()
    assert.equal(closed.business_status, 'temporarily_closed')

    const city = await CityFactory.apply('maringa').make()
    assert.equal(city.slug, 'maringa')
    assert.equal(city.ibge_code, '4115200')
    for (let index = 0; index < 20; index++) {
      const address = await EstablishmentRevisionAddressFactory.make()
      const dLat = (Number(address.latitude) - LONDRINA.latitude) * 111.32
      const dLng =
        (Number(address.longitude) - LONDRINA.longitude) *
        111.32 *
        Math.cos((LONDRINA.latitude * Math.PI) / 180)
      assert.isAtMost(Math.hypot(dLat, dLng), 3.01)
    }
  })

  test('a published place scenario is discoverable with content, an offer and reviews', async ({
    assert,
    client,
  }) => {
    await limiter.clear()
    const scenario = await createPublishedPlaceScenario({
      suffix: 'factory',
      city: 'maringa',
      category: 'pizzarias',
      withContent: true,
      withOffer: true,
      reviews: 3,
    })
    const host = scenario.tenant.slug + '.experimente.test'
    assert.equal(scenario.geography.city.slug, 'maringa')
    assert.equal(scenario.taxonomy.category.slug, 'pizzarias')
    assert.equal(scenario.establishment.published_revision_id, scenario.revision.id)

    const detail = await client
      .get(`/api/v1/catalog/cities/maringa/establishments/${scenario.revision.slug}`)
      .header('host', host)
    detail.assertStatus(200)
    assert.equal(detail.body().reviews.count, 3)
    assert.isNotNull(detail.body().cover)

    for (const kind of ['experiences', 'events', 'showcase-items']) {
      const listed = await client
        .get(`/api/v1/catalog/establishments/${scenario.establishment.id}/${kind}`)
        .header('host', host)
      listed.assertStatus(200)
      assert.lengthOf(listed.body().data, 1, kind)
    }
    assert.equal(scenario.offer?.status, 'active')
    assert.equal(scenario.edition?.status, 'published')
    assert.lengthOf(scenario.replies, 1)
    await limiter.clear()
  })
})
