import { randomBytes, randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { mock } from 'node:test'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { DEMO_EXPERIENCES } from '#database/support/demo/catalog/content'
import { DEMO_CITIES } from '#database/support/demo/catalog/geography'
import { DEMO_MARKER, DEMO_PLACES } from '#database/support/demo/catalog/places'
import env from '#start/env'
import BenefitEditionService from '#modules/benefits/services/benefit_edition_service'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentLifecycleModerationService from '#modules/establishments/services/establishment_lifecycle_moderation_service'
import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import Organization from '#modules/organizations/models/organization'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewService from '#modules/reviews/services/establishment_review_service'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import {
  ACCOUNT_KINDS,
  type HomologationProvisioningConfig,
} from '#modules/tenants/services/homologation_provisioning_config'
import HomologationProvisioningService, {
  DEMO_CATALOG_ACTION,
} from '#modules/tenants/services/homologation_provisioning_service'
import User from '#modules/users/models/user'
import { useFakePayments } from '#tests/helpers/fake_payments'

function configuration(): HomologationProvisioningConfig {
  const accounts = {} as HomologationProvisioningConfig['accounts']
  for (const kind of ACCOUNT_KINDS)
    accounts[kind] = {
      fullName: 'Catálogo ' + kind,
      email: randomUUID() + '@example.test',
      password: randomBytes(32).toString('base64url') + 'aB7',
    }
  return {
    tenantSlug: 'catalogo-' + randomUUID().slice(0, 8),
    tenantName: 'Homologação demonstrativa',
    accounts,
  }
}

/** Everything that belongs to the provisioned people: accounts, roles, memberships, accesses. */
async function humanState(accountIds: number[], tenantId: number) {
  return JSON.stringify({
    users: await db
      .from('users')
      .whereIn('id', accountIds)
      .orderBy('id')
      .select('id', 'email', 'full_name', 'password', 'is_deleted', 'credential_version'),
    roles: await db
      .from('user_roles')
      .whereIn('user_id', accountIds)
      .orderBy(['user_id', 'role_id']),
    tenants: await db
      .from('user_tenants')
      .whereIn('user_id', accountIds)
      .orderBy('user_id')
      .select('user_id', 'tenant_id', 'role'),
    memberships: await db
      .from('organization_members')
      .whereIn('user_id', accountIds)
      .orderBy('id')
      .select('id', 'organization_id', 'user_id', 'role', 'status'),
    accesses: await db
      .from('benefit_accesses')
      .where('tenant_id', tenantId)
      .orderBy('id')
      .select('id', 'user_id', 'edition_id', 'status', 'source'),
  })
}

async function countAll(tenantId: number) {
  const counts: Record<string, number> = {}
  for (const table of [
    'establishments',
    'establishment_revisions',
    'establishment_revision_media',
    'establishment_experiences',
    'establishment_events',
    'establishment_showcase_items',
    'establishment_reviews',
    'establishment_review_replies',
    'benefit_editions',
    'benefit_offers',
    'organizations',
    'cities',
    'categories',
  ]) {
    const row = await db.from(table).where('tenant_id', tenantId).count('* as total').first()
    counts[table] = Number(row.total)
  }
  return counts
}

test.group('Homologation demonstration catalogue', (group) => {
  group.each.setup(() => useFakePayments())
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => mock.restoreAll())
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  function deployment(value: string | undefined) {
    const original = env.get.bind(env)
    mock.method(env, 'get', (key: string, fallback?: string) =>
      key === 'DEPLOYMENT_ENV' ? value : (original(key) ?? fallback)
    )
  }

  async function baseline(cleanup: (fn: () => Promise<void>) => void) {
    deployment('homologation')
    const input = configuration()
    cleanup(() =>
      rm(app.makePath('storage', 'homologation/media/v1/fs', input.tenantSlug), {
        recursive: true,
        force: true,
      })
    )
    const service = new HomologationProvisioningService()
    const receipt = await service.run(input)
    await service.provisionDemoContent(input)
    const accounts = Object.values(receipt.accounts)
    return { input, service, receipt, accounts }
  }

  const host = (slug: string) => slug + '.experimente.test'

  test('extends a provisioned homologation with the published catalogue, exactly once', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { input, service, receipt, accounts } = await baseline(cleanup)
    const baselineRevisions = await EstablishmentRevision.query()
      .whereIn('establishment_id', receipt.establishmentIds)
      .orderBy('id')
    const baselineEditions = await BenefitEdition.query()
      .whereIn('id', receipt.editionIds)
      .orderBy('id')
    const before = await humanState(accounts, receipt.tenantId)

    const outcome = await service.provisionDemoCatalog(input)

    assert.deepEqual(outcome.notCreated, [])
    // What the baseline created is adopted by its slug, never recreated or edited.
    assert.includeMembers(outcome.alreadyPresent, [
      'region:norte-do-parana',
      'city:londrina',
      'family:comer-e-beber',
    ])
    assert.includeMembers(outcome.created, [
      'region:norte-pioneiro',
      'city:maringa',
      'category:restaurantes',
      'organization:terra-roxa',
      'place:maringa-bistro-cancao',
      'edition:passaporte-londrina-demo',
    ])
    assert.equal(await humanState(accounts, receipt.tenantId), before)
    const revisionsAfter = await EstablishmentRevision.query()
      .whereIn('establishment_id', receipt.establishmentIds)
      .orderBy('id')
    assert.deepEqual(
      revisionsAfter.map((revision) => revision.serialize()),
      baselineRevisions.map((revision) => revision.serialize())
    )
    const editionsAfter = await BenefitEdition.query()
      .whereIn('id', receipt.editionIds)
      .orderBy('id')
    assert.deepEqual(
      editionsAfter.map((edition) => edition.serialize()),
      baselineEditions.map((edition) => edition.serialize())
    )

    // Visible to anyone through the public surfaces of the operation.
    const cities = await client.get('/api/v1/catalog/cities').header('host', host(input.tenantSlug))
    cities.assertStatus(200)
    const slugs = JSON.stringify(cities.body())
    for (const city of DEMO_CITIES) assert.include(slugs, `"${city.slug}"`)
    const londrina = await db
      .from('catalog_establishments')
      .where('tenant_id', receipt.tenantId)
      .where('city_slug', 'londrina')
      .where('is_discoverable', true)
      .count('* as total')
      .first()
    assert.equal(
      Number(londrina.total),
      2 + DEMO_PLACES.filter((place) => place.city === 'londrina').length
    )
    const detail = await client
      .get('/api/v1/catalog/cities/maringa/establishments/bistro-cancao-demonstracao')
      .header('host', host(input.tenantSlug))
    detail.assertStatus(200)
    assert.include(detail.body().name, DEMO_MARKER.trim())
    assert.isAbove(detail.body().reviews.count, 0)

    // Demo accounts exist only as authors: reserved domain, no known password.
    const persona = await User.findByOrFail('email', 'mariana.t.demo@example.invalid')
    const signIn = await client
      .post('/api/v1/sessions/sign-in')
      .json({ uid: persona.email, password: 'experimente123' })
    assert.isAtLeast(signIn.status(), 400)

    // A replay finds every item and writes nothing.
    const counts = await countAll(receipt.tenantId)
    const again = await service.provisionDemoCatalog(input)
    assert.lengthOf(again.created, 0)
    assert.deepEqual(again.notCreated, [])
    assert.deepEqual(await countAll(receipt.tenantId), counts)
    assert.equal(await humanState(accounts, receipt.tenantId), before)
  }).timeout(900_000)

  test('never adopts, overwrites or restores what people created or decided', async ({
    assert,
    cleanup,
  }) => {
    const { input, service, receipt } = await baseline(cleanup)
    const administrator = await User.findOrFail(receipt.accounts.administrator)
    const customer = await User.findOrFail(receipt.accounts.customer)

    // Created by the operation before the catalogue: a category and an
    // organization that happen to use the catalogue's slugs.
    const family = await db
      .from('category_families')
      .where('tenant_id', receipt.tenantId)
      .where('slug', 'comer-e-beber')
      .firstOrFail()
    const ownCategory = await Category.create({
      tenant_id: receipt.tenantId,
      family_id: family.id,
      parent_id: null,
      name: 'Sorvetes da operação',
      slug: 'sorveterias',
      is_active: true,
      sort_order: 5,
      allows_always_open: false,
    })
    const ownOrganization = await Organization.create({
      tenant_id: receipt.tenantId,
      legal_name: 'Organização da operação',
      trade_name: 'Sabores da operação',
      slug: 'sabores-do-pioneiro-demo',
      tax_id: '11222333000181',
      email: 'operacao@example.test',
      phone: '4300000000',
      status: 'active',
      created_by: administrator.id,
    })

    const first = await service.provisionDemoCatalog(input)
    assert.include(first.alreadyPresent, 'category:sorveterias')
    assert.includeMembers(
      first.notCreated.map((item) => item.key),
      ['organization:sabores-pioneiro', 'place:cornelio-sabor-pioneiro']
    )
    assert.lengthOf(
      await CategoryAttributeDefinition.query().where('category_id', ownCategory.id),
      0,
      'a form the operation designed gets no fields from the catalogue'
    )
    await ownOrganization.refresh()
    assert.equal(ownOrganization.trade_name, 'Sabores da operação')
    assert.lengthOf(await Establishment.query().where('organization_id', ownOrganization.id), 0)

    // People act on the demo: a review, an archived experience, a suspended
    // place and a paused package.
    const cantina = await EstablishmentRevision.query()
      .where('tenant_id', receipt.tenantId)
      .where('slug', 'cantina-vale-verde-demonstracao')
      .firstOrFail()
    const reviews = await app.container.make(EstablishmentReviewService)
    const review = await reviews.create(receipt.tenantId, customer, {
      establishment_id: cantina.establishment_id,
      rating: 3,
      comment: 'Revisão humana.',
    })
    const experience = await EstablishmentExperience.query()
      .where('tenant_id', receipt.tenantId)
      .where('title', DEMO_EXPERIENCES[0].title)
      .firstOrFail()
    const content = await app.container.make(PartnerContentService)
    await content.archive('experience', receipt.tenantId, experience.id, administrator, {
      asModerator: true,
    })
    const smash = await EstablishmentRevision.query()
      .where('tenant_id', receipt.tenantId)
      .where('slug', 'smash-do-norte-demonstracao')
      .firstOrFail()
    const lifecycle = await app.container.make(EstablishmentLifecycleModerationService)
    await lifecycle.suspend(
      receipt.tenantId,
      smash.establishment_id,
      administrator,
      'Suspensão decidida pela moderação'
    )
    const edition = await BenefitEdition.query()
      .where('tenant_id', receipt.tenantId)
      .where('slug', 'passaporte-maringa-demo')
      .firstOrFail()
    const editions = await app.container.make(BenefitEditionService)
    await editions.pause(receipt.tenantId, edition.id, administrator)
    const counts = await countAll(receipt.tenantId)

    // A week later: only that week's events are new; every decision stands.
    const later = await service.provisionDemoCatalog(input, DateTime.utc().plus({ days: 7 }))
    assert.isTrue(
      later.created.every((key) => key.startsWith('event:')),
      later.created.join(', ')
    )
    assert.isAbove(later.created.length, 0)
    const after = await countAll(receipt.tenantId)
    assert.deepEqual(
      { ...after, establishment_events: counts.establishment_events },
      counts,
      'nothing but events was added'
    )
    await review.refresh()
    assert.equal(review.comment, 'Revisão humana.')
    assert.equal(review.rating, 3)
    await experience.refresh()
    assert.equal(experience.status, 'archived')
    const suspended = await Establishment.findOrFail(smash.establishment_id)
    assert.equal(suspended.lifecycle_status, 'suspended')
    await edition.refresh()
    assert.equal(edition.status, 'paused')
    assert.lengthOf(
      await EstablishmentReview.query()
        .where('establishment_id', cantina.establishment_id)
        .where('user_id', customer.id),
      1
    )
    const markers = await db
      .from('audit_logs')
      .where('resource_id', receipt.tenantId)
      .where('action', DEMO_CATALOG_ACTION)
      .count('* as total')
      .first()
    assert.equal(
      Number(markers.total),
      first.created.length + first.alreadyPresent.length + later.created.length
    )
  }).timeout(900_000)

  test('refused outside homologation, and never without the baseline', async ({ assert }) => {
    for (const value of [undefined, 'invalid', 'production', 'development']) {
      deployment(value)
      await assert.rejects(
        () => new HomologationProvisioningService().provisionDemoCatalog(configuration()),
        /DEPLOYMENT_ENV/
      )
      mock.restoreAll()
    }

    deployment('homologation')
    await assert.rejects(
      () => new HomologationProvisioningService().provisionDemoCatalog(configuration()),
      /run homologation:provision/
    )
    const markers = await db.from('audit_logs').where('action', DEMO_CATALOG_ACTION)
    assert.lengthOf(markers, 0)
  })
})
