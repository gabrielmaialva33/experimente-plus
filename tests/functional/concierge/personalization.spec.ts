import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import CatalogGroundingRepository from '#modules/concierge/repositories/catalog_grounding_repository'
import Category from '#modules/taxonomy/models/category'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })
const publicHeaders = (scenario: EstablishmentScenario) => ({
  'host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
})

/**
 * Three places: two cafés and a museum in its own category. Alphabetically the
 * cafés come first, so a prompt of two holds only them — unless the museum's
 * category is preferred.
 */
async function catalogue(scenario: EstablishmentScenario) {
  const museums = await Category.create({
    tenant_id: scenario.tenant.id,
    family_id: scenario.family.id,
    parent_id: null,
    name: 'Museus',
    slug: `museus-${scenario.tenant.id}`,
    description: null,
    icon: null,
    sort_order: 5,
    is_active: true,
    allows_always_open: false,
  })

  await createPublishedEstablishment(scenario, 'Alfa Café')
  await createPublishedEstablishment(scenario, 'Beta Café')
  const museum = await createPublishedEstablishment(scenario, 'Zeta Museu')

  await db
    .from('establishment_revision_categories')
    .where('tenant_id', scenario.tenant.id)
    .where('revision_id', museum.published_revision_id!)
    .update({ category_id: museums.id })
  await db.rawQuery('SELECT catalog_refresh_establishment(?, ?)', [scenario.tenant.id, museum.id])

  return { museums }
}

const names = (items: Array<{ name: string }>) => items.map((item) => item.name)

test.group('Concierge — interests (ADR-0029, 23/09/2026)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a preferred category decides what fits a prompt that cannot hold everything', async ({
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('cg-pref')
    const { museums } = await catalogue(scenario)
    const repository = new CatalogGroundingRepository()

    const plain = await repository.forQuestion(scenario.tenant.id, null, 2)
    assert.deepEqual(names(plain.offered), ['Alfa Café', 'Beta Café'])

    const preferred = await repository.forQuestion(scenario.tenant.id, null, 2, new Date(), [
      museums.id,
    ])
    assert.deepEqual(names(preferred.offered), ['Zeta Museu', 'Alfa Café'])

    // With room for everything, a preference adds and removes nothing.
    const roomy = await repository.forQuestion(scenario.tenant.id, null, 20, new Date(), [
      museums.id,
    ])
    assert.sameMembers(names(roomy.offered), ['Alfa Café', 'Beta Café', 'Zeta Museu'])
  })

  test('the public route is never personalised, even when a session is sent', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('cg-public')
    const { museums } = await catalogue(scenario)
    const explorer = await createUser({ prefix: 'cg-public-explorer', tenant: scenario.tenant })
    await client
      .put('/api/v1/me/interests')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
      .json({ category_slugs: [museums.slug] })

    const anonymous = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .json({ question: 'Onde passar a tarde?' })
    anonymous.assertStatus(200)
    assert.isFalse(anonymous.body().personalized)

    const withSession = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .loginAs(explorer)
      .json({ question: 'Onde passar a tarde?' })
    assert.isFalse(withSession.body().personalized)
    assert.deepEqual(names(withSession.body().items), names(anonymous.body().items))
  })

  test('without interests the personal route answers exactly what the public one does', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('cg-none')
    await catalogue(scenario)
    const explorer = await createUser({ prefix: 'cg-none-explorer', tenant: scenario.tenant })

    const publicReply = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .json({ question: 'Onde passar a tarde?' })
    const personal = await client
      .post('/api/v1/me/concierge')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
      .json({ question: 'Onde passar a tarde?' })

    personal.assertStatus(200)
    assert.isFalse(personal.body().personalized)
    assert.deepEqual(names(personal.body().items), names(publicReply.body().items))
    assert.equal(personal.header('cache-control'), 'private, no-store')
  })

  test('with interests the personal route says so', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('cg-with')
    const { museums } = await catalogue(scenario)
    const explorer = await createUser({ prefix: 'cg-with-explorer', tenant: scenario.tenant })
    const headers = tenantHeader(scenario.tenant.id)

    await client
      .put('/api/v1/me/interests')
      .headers(headers)
      .loginAs(explorer)
      .json({ category_slugs: [museums.slug] })

    const personal = await client
      .post('/api/v1/me/concierge')
      .headers(headers)
      .loginAs(explorer)
      .json({ question: 'Onde passar a tarde?' })

    personal.assertStatus(200)
    assert.isTrue(personal.body().personalized)
    assert.equal(personal.body().items[0].name, 'Zeta Museu')
  })

  test('a deactivated interest is not applied', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('cg-inactive')
    const { museums } = await catalogue(scenario)
    const explorer = await createUser({ prefix: 'cg-inactive-explorer', tenant: scenario.tenant })
    const headers = tenantHeader(scenario.tenant.id)

    await client
      .put('/api/v1/me/interests')
      .headers(headers)
      .loginAs(explorer)
      .json({ category_slugs: [museums.slug] })
    museums.is_active = false
    await museums.save()

    const personal = await client
      .post('/api/v1/me/concierge')
      .headers(headers)
      .loginAs(explorer)
      .json({ question: 'Onde passar a tarde?' })
    assert.isFalse(personal.body().personalized)
  })

  test('the personal route requires a session', async ({ client }) => {
    const response = await client.post('/api/v1/me/concierge').json({ question: 'Onde ir?' })
    response.assertStatus(401)
  })
})
