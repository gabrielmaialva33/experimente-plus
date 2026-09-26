import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import City from '#modules/geography/models/city'
import Category from '#modules/taxonomy/models/category'
import type Establishment from '#modules/establishments/models/establishment'
import type User from '#modules/users/models/user'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

async function refresh(establishment: Establishment) {
  await db.rawQuery('SELECT catalog_refresh_establishment(?, ?)', [
    establishment.tenant_id,
    establishment.id,
  ])
}

async function choose(
  client: ApiClient,
  scenario: EstablishmentScenario,
  explorer: User,
  slugs: string[]
) {
  const response = await client
    .put('/api/v1/me/interests')
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(explorer)
    .json({ category_slugs: slugs })
  response.assertStatus(200)
}

async function forYou(
  client: ApiClient,
  scenario: EstablishmentScenario,
  explorer: User,
  citySlug = scenario.city.slug
) {
  return client
    .get('/api/v1/me/for-you')
    .qs({ city: citySlug })
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(explorer)
}

const namesOf = (response: { body(): { data: Array<{ name: string }> } }) =>
  response.body().data.map((item) => item.name)

/** A category beside the scenario's own, for a place the interests do not cover. */
async function siblingCategory(scenario: EstablishmentScenario, name: string) {
  return Category.create({
    tenant_id: scenario.tenant.id,
    family_id: scenario.family.id,
    parent_id: null,
    name,
    slug: `${name.toLowerCase()}-${scenario.tenant.slug}`,
    description: null,
    icon: null,
    sort_order: 1,
    is_active: true,
    allows_always_open: false,
  })
}

/** Files a published place under another category and rebuilds its projection. */
async function refile(establishment: Establishment, category: Category) {
  await db
    .from('establishment_revision_categories')
    .where('revision_id', establishment.published_revision_id!)
    .update({ category_id: category.id })
  await refresh(establishment)
}

test.group('Explorer — "Para você" (ADR-0030, revision of 26/09/2026)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('needs a session', async ({ client }) => {
    const scenario = await createEstablishmentScenario('fy-anon')

    const response = await client
      .get('/api/v1/me/for-you')
      .qs({ city: scenario.city.slug })
      .headers(tenantHeader(scenario.tenant.id))

    response.assertStatus(401)
  })

  test('is empty until something is chosen, then shows the chosen places privately', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('fy-choose')
    await createPublishedEstablishment(scenario, 'Café Central')
    const explorer = await createUser({ prefix: 'fy-choose-explorer', tenant: scenario.tenant })

    const before = await forYou(client, scenario, explorer)
    before.assertStatus(200)
    assert.deepEqual(before.body(), { data: [], has_interests: false })
    assert.equal(before.header('cache-control'), 'private, no-store')

    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])

    const after = await forYou(client, scenario, explorer)
    after.assertStatus(200)
    assert.isTrue(after.body().has_interests)
    assert.deepEqual(namesOf(after), ['Café Central'])
    assert.equal(after.header('cache-control'), 'private, no-store')
  })

  test('draws each place with the organic search card, field for field', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('fy-shape')
    await createPublishedEstablishment(scenario, 'Café Central')
    const explorer = await createUser({ prefix: 'fy-shape-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])

    const personal = await forYou(client, scenario, explorer)
    const search = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments`)
      .headers({
        'host': `${scenario.tenant.slug}.experimente.test`,
        'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
      })

    search.assertStatus(200)
    assert.deepEqual(personal.body().data, search.body().organic_results)
  })

  test('shows only what the public catalogue can show', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fy-discoverable')
    await createPublishedEstablishment(scenario, 'Aberto Café')
    const suspended = await createPublishedEstablishment(scenario, 'Suspenso Café')
    const unpublished = await createPublishedEstablishment(scenario, 'Retirado Café')
    const coverless = await createPublishedEstablishment(scenario, 'Sem Capa Café')
    const explorer = await createUser({ prefix: 'fy-disc-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])

    suspended.lifecycle_status = 'suspended'
    suspended.suspended_at = DateTime.utc()
    await suspended.save()

    // The projection row survives a withdrawal; the revalidation must drop it.
    unpublished.published_revision_id = null
    await unpublished.save()

    await db
      .from('establishment_revision_media')
      .where('establishment_id', coverless.id)
      .update({ is_cover: false })
    await refresh(coverless)

    const response = await forYou(client, scenario, explorer)
    assert.deepEqual(namesOf(response), ['Aberto Café'])
  })

  test('drops a place the projection still lists after it was withdrawn', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('fy-stale')
    await createPublishedEstablishment(scenario, 'Aberto Café')
    const suspended = await createPublishedEstablishment(scenario, 'Suspenso Café')
    const explorer = await createUser({ prefix: 'fy-stale-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])

    // A projection that missed the change, which ADR-0016 §3 says can happen:
    // the source moves while the triggers that rebuild the row stay silent, so
    // only the revalidation of every read can keep the place out.
    const behindTheProjection = async (change: () => Promise<unknown>) => {
      await db.rawQuery('SET LOCAL session_replication_role = replica')
      await change()
      await db.rawQuery('SET LOCAL session_replication_role = origin')
    }

    await behindTheProjection(() =>
      db
        .from('establishments')
        .where('id', suspended.id)
        .update({ lifecycle_status: 'suspended', suspended_at: DateTime.utc().toJSDate() })
    )
    assert.deepEqual(namesOf(await forYou(client, scenario, explorer)), ['Aberto Café'])

    await behindTheProjection(() =>
      db.from('organizations').where('id', scenario.organization.id).update({ status: 'suspended' })
    )
    const withdrawn = await forYou(client, scenario, explorer)
    assert.deepEqual(withdrawn.body().data, [])
  })

  test('a chosen parent category brings the places filed under its children', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('fy-descendant')
    // The fixture files every place under the child category.
    await createPublishedEstablishment(scenario, 'Café Filho')
    const explorer = await createUser({ prefix: 'fy-desc-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.parentCategory.slug])

    const response = await forYou(client, scenario, explorer)
    assert.deepEqual(namesOf(response), ['Café Filho'])
  })

  test('a place outside every chosen category stays out', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fy-outside')
    await createPublishedEstablishment(scenario, 'Café Escolhido')
    const bar = await createPublishedEstablishment(scenario, 'Bar Fora')
    await refile(bar, await siblingCategory(scenario, 'Bares'))
    const explorer = await createUser({ prefix: 'fy-out-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])

    const response = await forYou(client, scenario, explorer)
    assert.deepEqual(namesOf(response), ['Café Escolhido'])
  })

  test('an interest whose category was deactivated counts for nothing', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('fy-inactive')
    await createPublishedEstablishment(scenario, 'Café Central')
    const explorer = await createUser({ prefix: 'fy-inact-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])

    const category = await Category.findOrFail(scenario.primaryCategory.id)
    category.is_active = false
    await category.save()

    const response = await forYou(client, scenario, explorer)
    assert.deepEqual(response.body(), { data: [], has_interests: false })
  })

  test('one explorer’s interests never shape another explorer’s row', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('fy-private')
    await createPublishedEstablishment(scenario, 'Café Central')
    const chooser = await createUser({ prefix: 'fy-priv-chooser', tenant: scenario.tenant })
    const other = await createUser({ prefix: 'fy-priv-other', tenant: scenario.tenant })
    await choose(client, scenario, chooser, [scenario.primaryCategory.slug])

    const response = await forYou(client, scenario, other)
    assert.deepEqual(response.body(), { data: [], has_interests: false })
  })

  test('stays inside the city asked for', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fy-city')
    await createPublishedEstablishment(scenario, 'Café Daqui')
    const elsewhere = await City.create({
      tenant_id: scenario.tenant.id,
      region_id: scenario.region.id,
      name: 'Outra Cidade',
      slug: `outra-cidade-${scenario.tenant.slug}`,
      state_code: 'PR',
      country_code: 'BR',
      ibge_code: null,
      timezone: 'America/Sao_Paulo',
      latitude: -23.3,
      longitude: -51.1,
      sort_order: 1,
      is_active: true,
    })
    await createPublishedEstablishment({ ...scenario, city: elsewhere }, 'Café Dali')
    const explorer = await createUser({ prefix: 'fy-city-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])

    assert.deepEqual(namesOf(await forYou(client, scenario, explorer)), ['Café Daqui'])
    assert.deepEqual(namesOf(await forYou(client, scenario, explorer, elsewhere.slug)), [
      'Café Dali',
    ])
  })

  test('refuses a city exactly as the public catalogue does', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fy-bad-city')
    const foreign = await createEstablishmentScenario('fy-bad-city-foreign')
    const explorer = await createUser({ prefix: 'fy-bad-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])
    const publicSearch = (citySlug: string) =>
      client.get(`/api/v1/catalog/cities/${citySlug}/establishments`).headers({
        'host': `${scenario.tenant.slug}.experimente.test`,
        'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
      })

    // Unknown, belonging to another operation, and malformed.
    for (const citySlug of ['cidade-inexistente', foreign.city.slug, 'Não É Slug']) {
      const personal = await forYou(client, scenario, explorer, citySlug)
      const search = await publicSearch(encodeURIComponent(citySlug))
      assert.equal(personal.status(), 404, citySlug)
      assert.equal(personal.status(), search.status(), citySlug)
    }

    const city = await City.findOrFail(scenario.city.id)
    city.is_active = false
    await city.save()
    const inactive = await forYou(client, scenario, explorer)
    inactive.assertStatus(404)
    const inactiveSearch = await publicSearch(scenario.city.slug)
    assert.equal(inactive.status(), inactiveSearch.status())

    const missing = await client
      .get('/api/v1/me/for-you')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
    missing.assertStatus(422)
  })

  test('never reaches into another operation', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fy-tenant')
    const foreign = await createEstablishmentScenario('fy-tenant-foreign')
    await createPublishedEstablishment(foreign, 'Café Alheio')
    const explorer = await createUser({ prefix: 'fy-tenant-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])

    // Same shape of interest, same shape of city — the other operation's rows
    // must still be invisible from this session.
    const response = await forYou(client, scenario, explorer)
    assert.deepEqual(response.body(), { data: [], has_interests: true })
  })

  test('orders by name as search does without a term, sponsorship included', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('fy-order')
    await createPublishedEstablishment(scenario, 'Gama Café')
    const zeta = await createPublishedEstablishment(scenario, 'Zeta Café')
    await createPublishedEstablishment(scenario, 'Alfa Café')
    await createPublishedEstablishment(scenario, 'Beta Café')
    // A sponsored place keeps its alphabetical place: this row has no slot to sell.
    await db
      .from('catalog_establishments')
      .where('establishment_id', zeta.id)
      .update({ is_sponsored: true, sponsored_priority: 99 })
    const explorer = await createUser({ prefix: 'fy-order-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])

    const response = await forYou(client, scenario, explorer)
    assert.deepEqual(namesOf(response), ['Alfa Café', 'Beta Café', 'Gama Café', 'Zeta Café'])
  })

  test('carries at most ten places', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fy-cap')
    for (let index = 0; index < 12; index++) {
      await createPublishedEstablishment(scenario, `Café ${String(index).padStart(2, '0')}`)
    }
    const explorer = await createUser({ prefix: 'fy-cap-explorer', tenant: scenario.tenant })
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])

    const response = await forYou(client, scenario, explorer)
    assert.lengthOf(response.body().data, 10)
    assert.deepEqual(
      namesOf(response),
      Array.from({ length: 10 }, (_, index) => `Café ${String(index).padStart(2, '0')}`)
    )
  })

  test('leaves public search exactly as it was', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('fy-search')
    await createPublishedEstablishment(scenario, 'Café Central')
    const bar = await createPublishedEstablishment(scenario, 'Bar Fora')
    await refile(bar, await siblingCategory(scenario, 'Bares'))
    const explorer = await createUser({ prefix: 'fy-search-explorer', tenant: scenario.tenant })
    const search = () =>
      client
        .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments`)
        .headers({
          'host': `${scenario.tenant.slug}.experimente.test`,
          'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
        })
        .loginAs(explorer)

    const before = await search()
    await choose(client, scenario, explorer, [scenario.primaryCategory.slug])
    await forYou(client, scenario, explorer)
    const after = await search()

    assert.lengthOf(before.body().organic_results, 2)
    assert.deepEqual(after.body().organic_results, before.body().organic_results)
  })
})
