import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Establishment from '#modules/establishments/models/establishment'
import Category from '#modules/taxonomy/models/category'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

async function explorerIn(scenario: EstablishmentScenario, prefix = 'explorer') {
  return createUser({ prefix, tenant: scenario.tenant })
}

// The table requires the timestamp to agree with the state, so a suspension is
// recorded the way the domain records one rather than as a bare flag.
async function suspend(establishment: Establishment) {
  establishment.lifecycle_status = 'suspended'
  establishment.suspended_at = DateTime.utc()
  await establishment.save()
}

async function reactivate(establishment: Establishment) {
  establishment.lifecycle_status = 'active'
  establishment.suspended_at = null
  await establishment.save()
}

test.group('Explorer — favourites and follows (ADR-0030)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('favouriting twice is one favourite and not an error', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('exp-twice')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await explorerIn(scenario)

    for (let attempt = 0; attempt < 2; attempt++) {
      const saved = await client
        .put(`/api/v1/me/favorites/${establishment.id}`)
        .headers(tenantHeader(scenario.tenant.id))
        .loginAs(explorer)
      saved.assertStatus(200)
      saved.assertBodyContains({ favorited: true })
    }

    const rows = await db
      .from('explorer_favorites')
      .where('user_id', explorer.id)
      .where('establishment_id', establishment.id)
    assert.lengthOf(rows, 1)

    const list = await client
      .get('/api/v1/me/favorites')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
    list.assertStatus(200)
    assert.lengthOf(list.body().data, 1)
    assert.equal(list.body().data[0].establishment.id, establishment.id)
    // The card carries the public link pair, never an address built from the id.
    assert.isString(list.body().data[0].establishment.slug)
    assert.isString(list.body().data[0].establishment.city_slug)
    assert.equal(list.header('cache-control'), 'private, no-store')
  })

  test('unfavouriting removes the link and nothing else', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('exp-unfav')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await explorerIn(scenario)

    await client
      .put(`/api/v1/me/favorites/${establishment.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)

    const removed = await client
      .delete(`/api/v1/me/favorites/${establishment.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
    removed.assertStatus(200)
    removed.assertBodyContains({ favorited: false })

    assert.isNotNull(await Establishment.find(establishment.id))
    const list = await client
      .get('/api/v1/me/favorites')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
    assert.lengthOf(list.body().data, 0)
  })

  test('a withdrawn establishment leaves the list, is counted, and comes back', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('exp-withdrawn')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await explorerIn(scenario)

    await client
      .put(`/api/v1/me/favorites/${establishment.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)

    await suspend(establishment)

    const hidden = await client
      .get('/api/v1/me/favorites')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
    // Not navigable: returning it would reopen through a side door what the
    // suspension closed. Counted: so the person is told rather than left to
    // believe the save vanished.
    assert.lengthOf(hidden.body().data, 0)
    assert.equal(hidden.body().unavailable, 1)

    // The row survives the suspension: the intent was the person's.
    const rows = await db.from('explorer_favorites').where('user_id', explorer.id)
    assert.lengthOf(rows, 1)

    await reactivate(establishment)

    const back = await client
      .get('/api/v1/me/favorites')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
    assert.lengthOf(back.body().data, 1)
    assert.equal(back.body().unavailable, 0)
  })

  test('saving a withdrawn establishment answers as if it did not exist', async ({ client }) => {
    const scenario = await createEstablishmentScenario('exp-probe')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await explorerIn(scenario)
    await suspend(establishment)

    // Otherwise the bookmark button becomes a way to ask what the server hides.
    const withdrawn = await client
      .put(`/api/v1/me/favorites/${establishment.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
    withdrawn.assertStatus(404)

    const absent = await client
      .put('/api/v1/me/favorites/2147480000')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
    absent.assertStatus(404)
  })

  test('following and favouriting are independent', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('exp-independent')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await explorerIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    await client.put(`/api/v1/me/favorites/${establishment.id}`).headers(headers).loginAs(explorer)
    await client.put(`/api/v1/me/follows/${establishment.id}`).headers(headers).loginAs(explorer)

    const unfollowed = await client
      .delete(`/api/v1/me/follows/${establishment.id}`)
      .headers(headers)
      .loginAs(explorer)
    unfollowed.assertBodyContains({ favorited: true, following: false })

    const status = await client
      .get(`/api/v1/me/saved/${establishment.id}`)
      .headers(headers)
      .loginAs(explorer)
    assert.deepEqual(status.body(), { favorited: true, following: false })
  })

  test('one explorer never reads another explorer’s saves', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('exp-idor')
    const establishment = await createPublishedEstablishment(scenario)
    const owner = await explorerIn(scenario, 'exp-owner')
    const other = await explorerIn(scenario, 'exp-other')
    const headers = tenantHeader(scenario.tenant.id)

    await client.put(`/api/v1/me/favorites/${establishment.id}`).headers(headers).loginAs(owner)
    await client.put(`/api/v1/me/follows/${establishment.id}`).headers(headers).loginAs(owner)

    const favorites = await client.get('/api/v1/me/favorites').headers(headers).loginAs(other)
    const follows = await client.get('/api/v1/me/follows').headers(headers).loginAs(other)
    const status = await client
      .get(`/api/v1/me/saved/${establishment.id}`)
      .headers(headers)
      .loginAs(other)

    assert.lengthOf(favorites.body().data, 0)
    assert.lengthOf(follows.body().data, 0)
    assert.deepEqual(status.body(), { favorited: false, following: false })
  })

  test('no public surface reveals who saved an establishment', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('exp-public')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await explorerIn(scenario)

    await client
      .put(`/api/v1/me/favorites/${establishment.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)

    const anonymous = await client.get('/api/v1/me/favorites')
    anonymous.assertStatus(401)

    const revision = await db
      .from('establishment_revisions')
      .where('id', establishment.published_revision_id!)
      .first()
    const city = await db.from('cities').where('id', revision.city_id).first()
    const publicDetail = await client
      .get(`/api/v1/catalog/cities/${city.slug}/establishments/${revision.slug}`)
      .headers({
        'host': `${scenario.tenant.slug}.experimente.test`,
        'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
      })

    publicDetail.assertStatus(200)
    const body = JSON.stringify(publicDetail.body())
    assert.notInclude(body, explorer.email)
    assert.notInclude(body, explorer.full_name)
    assert.notMatch(body, /favorit|follower/i)
  })
})

test.group('Explorer — interests (ADR-0030)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('choosing interests replaces the whole set', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('exp-interests')
    const explorer = await explorerIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const first = await client
      .put('/api/v1/me/interests')
      .headers(headers)
      .loginAs(explorer)
      .json({ category_slugs: [scenario.primaryCategory.slug, scenario.parentCategory.slug] })
    first.assertStatus(200)
    assert.lengthOf(first.body().data, 2)

    const second = await client
      .put('/api/v1/me/interests')
      .headers(headers)
      .loginAs(explorer)
      .json({ category_slugs: [scenario.primaryCategory.slug] })
    assert.deepEqual(
      second.body().data.map((interest: any) => interest.category.slug),
      [scenario.primaryCategory.slug]
    )

    const cleared = await client
      .put('/api/v1/me/interests')
      .headers(headers)
      .loginAs(explorer)
      .json({ category_slugs: [] })
    assert.lengthOf(cleared.body().data, 0)
  })

  test('a category of another operation is absent, not forbidden', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('exp-interest-own')
    const foreign = await createEstablishmentScenario('exp-interest-foreign')
    const explorer = await explorerIn(scenario)

    const response = await client
      .put('/api/v1/me/interests')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
      .json({ category_slugs: [foreign.primaryCategory.slug] })

    response.assertStatus(404)
    const rows = await db.from('explorer_interests').where('user_id', explorer.id)
    assert.lengthOf(rows, 0)
  })

  test('deactivating a category keeps the interest the person chose', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('exp-interest-inactive')
    const explorer = await explorerIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    await client
      .put('/api/v1/me/interests')
      .headers(headers)
      .loginAs(explorer)
      .json({ category_slugs: [scenario.primaryCategory.slug] })

    const category = await Category.findOrFail(scenario.primaryCategory.id)
    category.is_active = false
    await category.save()

    const list = await client.get('/api/v1/me/interests').headers(headers).loginAs(explorer)
    assert.lengthOf(list.body().data, 1)
    assert.isFalse(list.body().data[0].category.is_active)
  })

  test('registering interests does not change the order of discovery', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('exp-no-ranking')
    await createPublishedEstablishment(scenario, 'Alfa Café')
    await createPublishedEstablishment(scenario, 'Beta Bar')
    await createPublishedEstablishment(scenario, 'Gama Bistrô')
    const explorer = await explorerIn(scenario)
    const city = await db.from('cities').where('id', scenario.city.id).first()
    const publicHeaders = {
      'host': `${scenario.tenant.slug}.experimente.test`,
      'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
    }
    const search = () =>
      client
        .get(`/api/v1/catalog/cities/${city.slug}/establishments`)
        .headers(publicHeaders)
        .loginAs(explorer)

    const slugsOf = (response: Awaited<ReturnType<typeof search>>) =>
      (response.body().organic_results as Array<{ slug: string }>).map((item) => item.slug)

    const beforeResponse = await search()
    const before = slugsOf(beforeResponse)

    await client
      .put('/api/v1/me/interests')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
      .json({ category_slugs: [scenario.primaryCategory.slug] })

    const afterResponse = await search()
    const after = slugsOf(afterResponse)

    // Personalised ranking is its own domain. Doing it here, quietly, would
    // create prominence with no prominence contract.
    assert.isAbove(before.length, 0)
    assert.deepEqual(after, before)
  })
})

test.group('Explorer — itineraries (ADR-0030)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('an itinerary keeps the order chosen and allows the same place twice', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('exp-itinerary')
    const cafe = await createPublishedEstablishment(scenario, 'Café da Manhã')
    const bar = await createPublishedEstablishment(scenario, 'Bar da Noite')
    const explorer = await explorerIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/me/itineraries')
      .headers(headers)
      .loginAs(explorer)
      .json({ name: 'Sábado no centro', notes: 'Sair cedo.' })
    created.assertStatus(201)
    const id = created.body().id

    for (const establishment of [cafe, bar, cafe]) {
      const added = await client
        .post(`/api/v1/me/itineraries/${id}/stops`)
        .headers(headers)
        .loginAs(explorer)
        .json({ establishment_id: establishment.id })
      added.assertStatus(200)
    }

    const shown = await client
      .get(`/api/v1/me/itineraries/${id}`)
      .headers(headers)
      .loginAs(explorer)
    const stops = shown.body().stops
    // Lunch and coming back at night are two stops, not a duplicate.
    assert.deepEqual(
      stops.map((stop: any) => stop.establishment.id),
      [cafe.id, bar.id, cafe.id]
    )

    const reversed = [...stops].reverse().map((stop: any) => stop.id)
    const reordered = await client
      .put(`/api/v1/me/itineraries/${id}/stops/order`)
      .headers(headers)
      .loginAs(explorer)
      .json({ stop_ids: reversed })
    reordered.assertStatus(200)
    assert.deepEqual(
      reordered.body().stops.map((stop: any) => stop.id),
      reversed
    )

    const again = await client
      .get(`/api/v1/me/itineraries/${id}`)
      .headers(headers)
      .loginAs(explorer)
    assert.deepEqual(
      again.body().stops.map((stop: any) => stop.id),
      reversed
    )
  })

  test('a partial reorder is refused rather than guessed', async ({ client }) => {
    const scenario = await createEstablishmentScenario('exp-partial')
    const cafe = await createPublishedEstablishment(scenario, 'Café Um')
    const bar = await createPublishedEstablishment(scenario, 'Bar Dois')
    const explorer = await explorerIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/me/itineraries')
      .headers(headers)
      .loginAs(explorer)
      .json({ name: 'Roteiro' })
    const id = created.body().id
    await client
      .post(`/api/v1/me/itineraries/${id}/stops`)
      .headers(headers)
      .loginAs(explorer)
      .json({ establishment_id: cafe.id })
    const shown = await client
      .post(`/api/v1/me/itineraries/${id}/stops`)
      .headers(headers)
      .loginAs(explorer)
      .json({ establishment_id: bar.id })

    const onlyOne = await client
      .put(`/api/v1/me/itineraries/${id}/stops/order`)
      .headers(headers)
      .loginAs(explorer)
      .json({ stop_ids: [shown.body().stops[0].id] })
    onlyOne.assertStatus(400)
  })

  test('another explorer’s itinerary is absent, never forbidden', async ({ client }) => {
    const scenario = await createEstablishmentScenario('exp-itinerary-idor')
    const cafe = await createPublishedEstablishment(scenario)
    const owner = await explorerIn(scenario, 'exp-it-owner')
    const other = await explorerIn(scenario, 'exp-it-other')
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/me/itineraries')
      .headers(headers)
      .loginAs(owner)
      .json({ name: 'Privado' })
    const id = created.body().id

    const read = await client.get(`/api/v1/me/itineraries/${id}`).headers(headers).loginAs(other)
    read.assertStatus(404)

    const edit = await client
      .put(`/api/v1/me/itineraries/${id}`)
      .headers(headers)
      .loginAs(other)
      .json({ name: 'Tomado' })
    edit.assertStatus(404)

    const stop = await client
      .post(`/api/v1/me/itineraries/${id}/stops`)
      .headers(headers)
      .loginAs(other)
      .json({ establishment_id: cafe.id })
    stop.assertStatus(404)

    const remove = await client
      .delete(`/api/v1/me/itineraries/${id}`)
      .headers(headers)
      .loginAs(other)
    remove.assertStatus(404)
  })

  test('a stop whose place was withdrawn keeps its position without a card', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('exp-stop-gone')
    const cafe = await createPublishedEstablishment(scenario, 'Café Firme')
    const bar = await createPublishedEstablishment(scenario, 'Bar Suspenso')
    const explorer = await explorerIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/me/itineraries')
      .headers(headers)
      .loginAs(explorer)
      .json({ name: 'Com lacuna' })
    const id = created.body().id
    for (const establishment of [cafe, bar]) {
      await client
        .post(`/api/v1/me/itineraries/${id}/stops`)
        .headers(headers)
        .loginAs(explorer)
        .json({ establishment_id: establishment.id, note: `parada ${establishment.id}` })
    }

    await suspend(bar)

    const shown = await client
      .get(`/api/v1/me/itineraries/${id}`)
      .headers(headers)
      .loginAs(explorer)
    const stops = shown.body().stops
    assert.lengthOf(stops, 2)
    assert.equal(stops[0].establishment.id, cafe.id)
    // Dropping the stop would rewrite a route its author wrote.
    assert.isNull(stops[1].establishment)
    assert.equal(stops[1].note, `parada ${bar.id}`)
  })
})

test.group('Explorer — account deletion (ADR-0030)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('deleting the account erases the personal layer while the user stays a tombstone', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('exp-delete')
    const establishment = await createPublishedEstablishment(scenario)
    const explorer = await explorerIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    await client.put(`/api/v1/me/favorites/${establishment.id}`).headers(headers).loginAs(explorer)
    await client.put(`/api/v1/me/follows/${establishment.id}`).headers(headers).loginAs(explorer)
    await client
      .put('/api/v1/me/interests')
      .headers(headers)
      .loginAs(explorer)
      .json({ category_slugs: [scenario.primaryCategory.slug] })
    const itinerary = await client
      .post('/api/v1/me/itineraries')
      .headers(headers)
      .loginAs(explorer)
      .json({ name: 'Vai sumir' })
    await client
      .post(`/api/v1/me/itineraries/${itinerary.body().id}/stops`)
      .headers(headers)
      .loginAs(explorer)
      .json({ establishment_id: establishment.id })

    const deleted = await client.delete('/api/v1/me').loginAs(explorer).json({
      current_password: 'password123',
      confirmation: 'EXCLUIR MINHA CONTA',
    })
    deleted.assertStatus(204)

    // The row stays: published content can still point at it.
    const tombstone = await db.from('users').where('id', explorer.id).first()
    assert.isTrue(tombstone.is_deleted)

    for (const table of [
      'explorer_favorites',
      'explorer_follows',
      'explorer_interests',
      'explorer_itineraries',
    ]) {
      const rows = await db.from(table).where('user_id', explorer.id)
      assert.lengthOf(rows, 0, `${table} must be erased with the account`)
    }
    const stops = await db
      .from('explorer_itinerary_items')
      .where('itinerary_id', itinerary.body().id)
    assert.lengthOf(stops, 0)
  })
})
