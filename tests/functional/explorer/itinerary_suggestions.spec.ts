import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Establishment from '#modules/establishments/models/establishment'
import City from '#modules/geography/models/city'
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

/** Gives the published revision an address and rebuilds the projection from it. */
async function placeAt(
  establishment: Establishment,
  coordinates: { latitude: number; longitude: number } | null,
  street: { street: string; number: string | null; district: string | null } = {
    street: 'Rua Sergipe',
    number: '100',
    district: 'Centro',
  }
) {
  await db.table('establishment_revision_addresses').insert({
    tenant_id: establishment.tenant_id,
    revision_id: establishment.published_revision_id,
    street: street.street,
    number: street.number,
    without_number: street.number === null,
    district: street.district,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    coordinate_source: coordinates ? 'manual' : null,
  })
  await refresh(establishment)
}

/** Records establishment views as the analytics aggregation does, `daysAgo` before today. */
async function viewed(establishment: Establishment, count: number, daysAgo = 1) {
  const day = DateTime.utc().minus({ days: daysAgo }).startOf('day')
  const revision = await db
    .from('establishment_revisions')
    .where('id', establishment.published_revision_id!)
    .first()
  await db.table('analytics_daily_metrics').insert({
    tenant_id: establishment.tenant_id,
    metric_date: day.toISODate(),
    event_type: 'establishment_view',
    establishment_id: establishment.id,
    city_id: revision.city_id,
    source: 'web',
    event_count: count,
    unique_sessions: count,
    first_event_at: day.plus({ hours: 9 }).toJSDate(),
    last_event_at: day.plus({ hours: 10 }).toJSDate(),
    expires_at: day.plus({ years: 2 }).toJSDate(),
  })
}

/** A second published city of the same operation and region. */
async function secondCity(scenario: EstablishmentScenario) {
  return City.create({
    tenant_id: scenario.tenant.id,
    region_id: scenario.region.id,
    name: `Outra ${scenario.city.name}`,
    slug: `outra-${scenario.city.slug}`,
    state_code: 'PR',
    country_code: 'BR',
    ibge_code: null,
    timezone: 'America/Sao_Paulo',
    latitude: -23.42,
    longitude: -51.93,
    sort_order: 1,
    is_active: true,
  })
}

/** Moves a published place to another city and rebuilds its projection. */
async function moveTo(establishment: Establishment, city: City) {
  await db
    .from('establishment_revisions')
    .where('id', establishment.published_revision_id!)
    .update({ city_id: city.id })
  await refresh(establishment)
}

async function itineraryOf(
  client: ApiClient,
  scenario: EstablishmentScenario,
  explorer: User,
  stops: Establishment[]
): Promise<number> {
  const headers = tenantHeader(scenario.tenant.id)
  const created = await client
    .post('/api/v1/me/itineraries')
    .headers(headers)
    .loginAs(explorer)
    .json({ name: 'Sábado' })
  created.assertStatus(201)
  for (const stop of stops) {
    const added = await client
      .post(`/api/v1/me/itineraries/${created.body().id}/stops`)
      .headers(headers)
      .loginAs(explorer)
      .json({ establishment_id: stop.id })
    added.assertStatus(200)
  }
  return created.body().id
}

function suggestionsOf(
  client: ApiClient,
  scenario: EstablishmentScenario,
  explorer: User,
  itineraryId: number,
  city?: string
) {
  const request = client
    .get(`/api/v1/me/itineraries/${itineraryId}/suggestions`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(explorer)
  return city === undefined ? request : request.qs({ city })
}

const namesOf = (response: { body(): { data: Array<{ establishment: { name: string } }> } }) =>
  response.body().data.map((item) => item.establishment.name)

test.group('Explorer — itinerary stop addresses', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a stop carries its place’s public address, and none once the place is gone', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('it-address')
    const cafe = await createPublishedEstablishment(scenario, 'Café Endereço')
    const bare = await createPublishedEstablishment(scenario, 'Bar Sem Endereço')
    const gone = await createPublishedEstablishment(scenario, 'Bistrô Suspenso')
    await placeAt(cafe, null, { street: 'Rua Pará', number: null, district: 'Centro' })
    const explorer = await createUser({ prefix: 'it-address-explorer', tenant: scenario.tenant })
    const id = await itineraryOf(client, scenario, explorer, [cafe, bare, gone])

    const establishment = await Establishment.findOrFail(gone.id)
    establishment.lifecycle_status = 'suspended'
    establishment.suspended_at = DateTime.utc()
    await establishment.save()

    const shown = await client
      .get(`/api/v1/me/itineraries/${id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(explorer)
    shown.assertStatus(200)
    const [first, second, third] = shown.body().stops
    assert.deepEqual(first.address, {
      street: 'Rua Pará',
      number: null,
      without_number: true,
      complement: null,
      district: 'Centro',
    })
    // A place published without an address has one with nothing in it.
    assert.deepEqual(second.address, {
      street: null,
      number: null,
      without_number: false,
      complement: null,
      district: null,
    })
    assert.isNull(third.establishment)
    assert.isNull(third.address)
  })
})

test.group('Explorer — itinerary suggestions', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('needs a session, and another explorer’s itinerary is absent', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('it-suggest-owner')
    await createPublishedEstablishment(scenario, 'Café Aberto')
    const owner = await createUser({ prefix: 'it-suggest-owner', tenant: scenario.tenant })
    const other = await createUser({ prefix: 'it-suggest-other', tenant: scenario.tenant })
    const id = await itineraryOf(client, scenario, owner, [])

    const anonymous = await client
      .get(`/api/v1/me/itineraries/${id}/suggestions`)
      .headers(tenantHeader(scenario.tenant.id))
    anonymous.assertStatus(401)

    const foreign = await suggestionsOf(client, scenario, other, id)
    foreign.assertStatus(404)

    const own = await suggestionsOf(client, scenario, owner, id)
    own.assertStatus(200)
    assert.equal(own.header('cache-control'), 'private, no-store')
    assert.deepEqual(namesOf(own), ['Café Aberto'])
  })

  test('an itinerary is absent from another operation of the same person', async ({ client }) => {
    const scenario = await createEstablishmentScenario('it-suggest-tenant')
    const foreign = await createEstablishmentScenario('it-suggest-tenant-other')
    const explorer = await createUser({ prefix: 'it-suggest-tenant', tenant: scenario.tenant })
    await explorer.related('tenants').attach({ [foreign.tenant.id]: { role: 'member' } })
    const id = await itineraryOf(client, scenario, explorer, [])

    const response = await client
      .get(`/api/v1/me/itineraries/${id}/suggestions`)
      .headers(tenantHeader(foreign.tenant.id))
      .loginAs(explorer)
    response.assertStatus(404)
  })

  test('never suggests a place already in the itinerary', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('it-suggest-exclude')
    const cafe = await createPublishedEstablishment(scenario, 'Café Parada')
    const bar = await createPublishedEstablishment(scenario, 'Bar Parada')
    await createPublishedEstablishment(scenario, 'Bistrô Livre')
    await placeAt(cafe, { latitude: -23.3, longitude: -51.16 })
    const explorer = await createUser({ prefix: 'it-suggest-exclude', tenant: scenario.tenant })
    const id = await itineraryOf(client, scenario, explorer, [cafe, bar, cafe])

    const response = await suggestionsOf(client, scenario, explorer, id)
    response.assertStatus(200)
    assert.deepEqual(namesOf(response), ['Bistrô Livre'])
  })

  test('ranks by distance to the stops, then by views of the last 30 days', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('it-suggest-order')
    const stop = await createPublishedEstablishment(scenario, 'Parada Central')
    const south = await createPublishedEstablishment(scenario, 'Café Sul')
    const north = await createPublishedEstablishment(scenario, 'Café Norte')
    const far = await createPublishedEstablishment(scenario, 'Café Longe')
    const unknown = await createPublishedEstablishment(scenario, 'Café Sem Mapa')
    await placeAt(stop, { latitude: -23.3, longitude: -51.16 })
    // About 500 m south and north: the same distance in steps of 100 m.
    await placeAt(south, { latitude: -23.3045, longitude: -51.16 })
    await placeAt(north, { latitude: -23.2955, longitude: -51.16 })
    await placeAt(far, { latitude: -23.345, longitude: -51.16 })
    await placeAt(unknown, null)
    await viewed(north, 12)
    await viewed(south, 3)
    // Views outside the window do not count.
    await viewed(south, 500, 45)
    // A popular place far away stays behind the near ones.
    await viewed(far, 900)
    await viewed(unknown, 1000)
    const explorer = await createUser({ prefix: 'it-suggest-order', tenant: scenario.tenant })
    const id = await itineraryOf(client, scenario, explorer, [stop])

    const response = await suggestionsOf(client, scenario, explorer, id)
    response.assertStatus(200)
    assert.equal(response.body().basis, 'nearby')
    assert.deepEqual(namesOf(response), ['Café Norte', 'Café Sul', 'Café Longe', 'Café Sem Mapa'])
    const distances = response.body().data.map((item: any) => item.distance_km)
    assert.deepEqual(distances, [0.5, 0.5, 5, null])
    // The views order the list; they are never handed out.
    assert.notInclude(JSON.stringify(response.body()), 'views')
    assert.notProperty(response.body().data[0], 'views')
  })

  test('an empty itinerary suggests the most viewed of the city asked for, or of the operation', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('it-suggest-empty')
    const other = await secondCity(scenario)
    const local = await createPublishedEstablishment(scenario, 'Café Local')
    const quiet = await createPublishedEstablishment(scenario, 'Café Quieto')
    const away = await createPublishedEstablishment(scenario, 'Café Distante')
    await moveTo(away, other)
    await viewed(local, 5)
    await viewed(away, 50)
    const explorer = await createUser({ prefix: 'it-suggest-empty', tenant: scenario.tenant })
    const id = await itineraryOf(client, scenario, explorer, [])

    const operation = await suggestionsOf(client, scenario, explorer, id)
    operation.assertStatus(200)
    assert.equal(operation.body().basis, 'popular')
    assert.deepEqual(namesOf(operation), ['Café Distante', 'Café Local', 'Café Quieto'])
    assert.deepEqual(
      operation.body().data.map((item: any) => item.distance_km),
      [null, null, null]
    )

    const city = await suggestionsOf(client, scenario, explorer, id, scenario.city.slug)
    city.assertStatus(200)
    assert.deepEqual(namesOf(city), ['Café Local', 'Café Quieto'])

    const unknown = await suggestionsOf(client, scenario, explorer, id, 'cidade-que-nao-existe')
    unknown.assertStatus(404)

    // A stop without coordinates gives the itinerary its city, over the one asked for.
    await quiet.refresh()
    const located = await itineraryOf(client, scenario, explorer, [quiet])
    const fromStop = await suggestionsOf(client, scenario, explorer, located, other.slug)
    fromStop.assertStatus(200)
    assert.equal(fromStop.body().basis, 'popular')
    assert.deepEqual(namesOf(fromStop), ['Café Local'])
  })

  test('never suggests a withdrawn, closed or foreign place', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('it-suggest-hidden')
    const foreign = await createEstablishmentScenario('it-suggest-hidden-foreign')
    await createPublishedEstablishment(scenario, 'Café Visível')
    const suspended = await createPublishedEstablishment(scenario, 'Café Suspenso')
    const closed = await createPublishedEstablishment(scenario, 'Café Fechado')
    const foreignPlace = await createPublishedEstablishment(foreign, 'Café de Fora')
    await viewed(suspended, 100)
    await viewed(closed, 100)
    await viewed(foreignPlace, 100)

    const establishment = await Establishment.findOrFail(suspended.id)
    establishment.lifecycle_status = 'suspended'
    establishment.suspended_at = DateTime.utc()
    await establishment.save()
    const temporarily = await Establishment.findOrFail(closed.id)
    temporarily.business_status = 'temporarily_closed'
    await temporarily.save()
    await refresh(temporarily)

    const explorer = await createUser({ prefix: 'it-suggest-hidden', tenant: scenario.tenant })
    const id = await itineraryOf(client, scenario, explorer, [])

    const response = await suggestionsOf(client, scenario, explorer, id)
    response.assertStatus(200)
    assert.deepEqual(namesOf(response), ['Café Visível'])
  })

  test('offers six places at most', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('it-suggest-limit')
    for (const name of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      await createPublishedEstablishment(scenario, `Café ${name}`)
    }
    const explorer = await createUser({ prefix: 'it-suggest-limit', tenant: scenario.tenant })
    const id = await itineraryOf(client, scenario, explorer, [])

    const response = await suggestionsOf(client, scenario, explorer, id)
    assert.deepEqual(namesOf(response), [
      'Café A',
      'Café B',
      'Café C',
      'Café D',
      'Café E',
      'Café F',
    ])
  })
})
