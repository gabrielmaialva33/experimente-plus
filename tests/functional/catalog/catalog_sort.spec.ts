import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime, Settings } from 'luxon'

import { BenefitEditionFactory, BenefitOfferFactory } from '#database/factories/index'
import BenefitOfferRepository from '#modules/benefits/repositories/benefit_offer_repository'
import BenefitAvailabilityService from '#modules/benefits/services/benefit_availability_service'
import type Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'

const SUNDAY = 1
const MONDAY = 2
const TUESDAY = 4
const EVERY_DAY = 127

/** Londrina's cathedral, the visitor's position in the distance searches. */
const ORIGIN = { lat: -23.3105, lng: -51.1628 }

function inertiaProps(response: { text(): string }): Record<string, any> {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('The response does not contain an Inertia page payload')
  return JSON.parse(match[1]).props
}

const publicHeaders = (scenario: EstablishmentScenario) => ({
  'host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-for': `198.51.100.${(scenario.tenant.id % 250) + 1}`,
})

interface PlaceOptions {
  /** Where the place is; without it the projection has no coordinates. */
  at?: { latitude: number; longitude: number }
  /** "Ticket médio", in reais. */
  ticket?: number
  /** The projection's public rating, as the review aggregate would leave it. */
  reviews?: { count: number; average: number | null }
}

async function ticketDefinition(scenario: EstablishmentScenario) {
  return CategoryAttributeDefinition.create({
    tenant_id: scenario.tenant.id,
    category_id: scenario.primaryCategory.id,
    key: 'average_ticket',
    name: 'Ticket médio',
    description: 'Valor médio por pessoa, em reais.',
    data_type: 'decimal',
    unit: null,
    is_required: false,
    is_filterable: false,
    is_public: true,
    applies_to_descendants: false,
    sort_order: 2,
    is_active: true,
    validation_rules: { minimum: 0, maximum: 500 },
  })
}

async function place(
  scenario: EstablishmentScenario,
  name: string,
  options: PlaceOptions = {},
  ticket: CategoryAttributeDefinition | null = null
): Promise<Establishment> {
  const establishment = await createPublishedEstablishment(scenario, name)
  const revisionId = establishment.published_revision_id!

  if (options.at) {
    await EstablishmentRevisionAddress.create({
      tenant_id: scenario.tenant.id,
      revision_id: revisionId,
      postal_code: '86010000',
      street: 'Rua de teste',
      number: '10',
      without_number: false,
      complement: null,
      district: 'Centro',
      reference: null,
      latitude: options.at.latitude,
      longitude: options.at.longitude,
      coordinate_source: 'manual',
      geocoded_at: null,
    })
  }
  if (options.ticket !== undefined && ticket) {
    await EstablishmentRevisionAttributeValue.create({
      tenant_id: scenario.tenant.id,
      revision_id: revisionId,
      attribute_definition_id: ticket.id,
      value_text: null,
      value_boolean: null,
      value_integer: null,
      value_decimal: options.ticket,
      value_url: null,
    })
  }

  await db.rawQuery('SELECT catalog_refresh_establishment(?, ?)', [
    scenario.tenant.id,
    establishment.id,
  ])

  if (options.reviews) {
    await db
      .from('catalog_establishments')
      .where('tenant_id', scenario.tenant.id)
      .where('establishment_id', establishment.id)
      .update({
        reviews_count: options.reviews.count,
        reviews_average: options.reviews.average,
      })
  }

  return establishment
}

type SearchBody = {
  organic_results: Array<{ name: string; benefit_today: boolean }>
  query: Record<string, unknown>
  meta: { total: number; last_page: number }
}

async function search(
  client: ApiClient,
  scenario: EstablishmentScenario,
  query: Record<string, string | number | boolean>
) {
  return client
    .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments`)
    .qs(query)
    .headers(publicHeaders(scenario))
}

const names = (response: { body(): SearchBody }) =>
  response.body().organic_results.map((item) => item.name)

/** Every page of one order, in sequence: what a person scrolling would see. */
async function allPages(
  client: ApiClient,
  scenario: EstablishmentScenario,
  query: Record<string, string | number | boolean>
) {
  const seen: string[] = []
  for (let page = 1; ; page++) {
    const response = await search(client, scenario, { ...query, page, per_page: 2 })
    response.assertStatus(200)
    seen.push(...names(response))
    if (page >= response.body().meta.last_page) return seen
  }
}

test.group('Public catalog orders', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('rating puts the best average first, the larger count on a tie and the unrated last', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('catalog-sort-rating')
    await place(scenario, 'Sem nota B')
    await place(scenario, 'Muitas 4,8', { reviews: { count: 10, average: 4.8 } })
    await place(scenario, 'Poucas 4,8', { reviews: { count: 3, average: 4.8 } })
    await place(scenario, 'Sem nota A')
    await place(scenario, 'Uma 5,0', { reviews: { count: 1, average: 5 } })
    await place(scenario, 'Nota 3,9', { reviews: { count: 40, average: 3.9 } })

    const response = await search(client, scenario, { sort: 'rating' })

    response.assertStatus(200)
    assert.equal(response.body().query.sort, 'rating')
    assert.deepEqual(names(response), [
      'Uma 5,0',
      'Muitas 4,8',
      'Poucas 4,8',
      'Nota 3,9',
      'Sem nota B',
      'Sem nota A',
    ])
    assert.deepEqual(await allPages(client, scenario, { sort: 'rating' }), names(response))
  })

  test('distance puts the nearest first and places without coordinates last', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('catalog-sort-distance')
    await place(scenario, 'Sem endereço')
    await place(scenario, 'Longe', { at: { latitude: -23.33, longitude: -51.2 } })
    await place(scenario, 'Perto', { at: { latitude: -23.311, longitude: -51.163 } })
    await place(scenario, 'Médio', { at: { latitude: -23.32, longitude: -51.17 } })
    await place(scenario, 'Outra cidade', { at: { latitude: -23.42, longitude: -51.93 } })

    const response = await search(client, scenario, { sort: 'distance', ...ORIGIN })

    response.assertStatus(200)
    assert.deepEqual(names(response), ['Perto', 'Médio', 'Longe', 'Outra cidade', 'Sem endereço'])
    assert.deepEqual(
      await allPages(client, scenario, { sort: 'distance', ...ORIGIN }),
      names(response)
    )

    // The position stays in the request: not echoed, not cacheable by anyone else.
    response.assertHeader('cache-control', 'private, no-store')
    assert.deepEqual(response.body().query, {
      q: null,
      category: null,
      open_now: false,
      benefit_today: false,
      attributes: [],
      sort: 'distance',
    })
    const body = JSON.stringify(response.body())
    assert.notInclude(body, String(ORIGIN.lat))
    assert.notInclude(body, String(ORIGIN.lng))
  })

  test('distance refuses to run without a valid position', async ({ client }) => {
    const scenario = await createEstablishmentScenario('catalog-sort-distance-validation')
    await place(scenario, 'Perto', { at: { latitude: -23.311, longitude: -51.163 } })

    const withoutPosition = await search(client, scenario, { sort: 'distance' })
    withoutPosition.assertStatus(422)
    withoutPosition.assertBodyContains({ errors: [{ field: 'lat' }, { field: 'lng' }] })

    const latitudeOnly = await search(client, scenario, { sort: 'distance', lat: ORIGIN.lat })
    latitudeOnly.assertStatus(422)
    latitudeOnly.assertBodyContains({ errors: [{ field: 'lng' }] })

    const longitudeOnly = await search(client, scenario, { sort: 'distance', lng: ORIGIN.lng })
    longitudeOnly.assertStatus(422)
    longitudeOnly.assertBodyContains({ errors: [{ field: 'lat' }] })

    for (const [lat, lng, field] of [
      [90.5, ORIGIN.lng, 'lat'],
      [-91, ORIGIN.lng, 'lat'],
      [ORIGIN.lat, 180.01, 'lng'],
      [ORIGIN.lat, -181, 'lng'],
    ] as const) {
      const outOfRange = await search(client, scenario, { sort: 'distance', lat, lng })
      outOfRange.assertStatus(422)
      outOfRange.assertBodyContains({ errors: [{ field }] })
    }

    const notANumber = await client
      .get(
        `/api/v1/catalog/cities/${scenario.city.slug}/establishments?sort=distance&lat=perto&lng=-51.16`
      )
      .headers(publicHeaders(scenario))
    notANumber.assertStatus(422)
    notANumber.assertBodyContains({ errors: [{ field: 'lat' }] })
  })

  test('a position sent with another order is ignored and never cached publicly', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('catalog-sort-stray-position')
    await place(scenario, 'Bravo', { at: { latitude: -23.33, longitude: -51.2 } })
    await place(scenario, 'Alfa', { at: { latitude: -23.311, longitude: -51.163 } })

    const response = await search(client, scenario, { sort: 'name', ...ORIGIN })

    response.assertStatus(200)
    response.assertHeader('cache-control', 'private, no-store')
    assert.deepEqual(names(response), ['Alfa', 'Bravo'])
    assert.equal(response.body().query.sort, 'name')

    const plain = await search(client, scenario, { sort: 'name' })
    plain.assertHeader('cache-control', 'public, max-age=60, stale-while-revalidate=120')
  })

  test('price follows the average ticket upwards with the undeclared last', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('catalog-sort-price')
    const ticket = await ticketDefinition(scenario)
    await place(scenario, 'Sem ticket', {}, ticket)
    await place(scenario, 'Ticket 55,50', { ticket: 55.5 }, ticket)
    await place(scenario, 'Ticket 30 A', { ticket: 30 }, ticket)
    await place(scenario, 'Ticket 18', { ticket: 18 }, ticket)
    await place(scenario, 'Ticket 30 B', { ticket: 30 }, ticket)

    const response = await search(client, scenario, { sort: 'price' })

    response.assertStatus(200)
    assert.deepEqual(names(response), [
      'Ticket 18',
      'Ticket 30 A',
      'Ticket 30 B',
      'Ticket 55,50',
      'Sem ticket',
    ])
    assert.deepEqual(await allPages(client, scenario, { sort: 'price' }), names(response))
  })

  test('relevance stays the default order', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('catalog-sort-default')
    await place(scenario, 'Bravo')
    await place(scenario, 'Alfa')

    const response = await search(client, scenario, {})

    response.assertStatus(200)
    assert.equal(response.body().query.sort, 'relevance')
    assert.deepEqual(names(response), ['Alfa', 'Bravo'])
  })
})

test.group('Public catalog "Vale hoje"', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /** Freezes "now" for Luxon, which the benefit rules read, for one test. */
  function freeze(iso: string, cleanup: (callback: () => void) => void) {
    const previous = Settings.now
    const frozen = DateTime.fromISO(iso).toMillis()
    Settings.now = () => frozen
    cleanup(() => {
      Settings.now = previous
    })
  }

  async function edition(scenario: EstablishmentScenario, state: 'published' | 'paused') {
    return BenefitEditionFactory.apply(state)
      .merge({
        tenant_id: scenario.tenant.id,
        city_id: scenario.city.id,
        usage_starts_at: DateTime.fromISO('2026-10-01T03:00:00Z'),
        usage_ends_at: DateTime.fromISO('2026-12-31T03:00:00Z'),
        sales_starts_at: DateTime.fromISO('2026-09-15T03:00:00Z'),
        sales_ends_at: DateTime.fromISO('2026-12-01T03:00:00Z'),
      })
      .create()
  }

  async function offer(
    scenario: EstablishmentScenario,
    editionId: number,
    establishment: Establishment,
    overrides: Record<string, unknown> = {},
    state: 'active' | 'paused' = 'active'
  ) {
    return BenefitOfferFactory.apply(state)
      .merge({
        tenant_id: scenario.tenant.id,
        edition_id: editionId,
        establishment_id: establishment.id,
        ...overrides,
      })
      .create()
  }

  test('keeps only places whose offer the weekday mask allows today, in the city timezone', async ({
    client,
    assert,
    cleanup,
  }) => {
    // 23:30 on Monday in São Paulo, already 02:30 on Tuesday in UTC.
    freeze('2026-10-13T02:30:00Z', cleanup)
    const scenario = await createEstablishmentScenario('catalog-benefit-today')
    const published = await edition(scenario, 'published')
    const monday = await place(scenario, 'Vale segunda')
    const tuesday = await place(scenario, 'Vale terça')
    const everyDay = await place(scenario, 'Vale sempre')
    const sunday = await place(scenario, 'Vale domingo')
    await place(scenario, 'Sem benefício')
    await offer(scenario, published.id, monday, { available_weekdays_mask: MONDAY })
    await offer(scenario, published.id, tuesday, { available_weekdays_mask: TUESDAY })
    await offer(scenario, published.id, everyDay, { available_weekdays_mask: EVERY_DAY })
    await offer(scenario, published.id, sunday, { available_weekdays_mask: SUNDAY })

    const filtered = await search(client, scenario, { benefit_today: true })

    filtered.assertStatus(200)
    assert.isTrue(filtered.body().query.benefit_today)
    assert.deepEqual(names(filtered), ['Vale segunda', 'Vale sempre'])

    // Without the filter every place stays, and the card flag says which one is valid today.
    const all = await search(client, scenario, {})
    assert.deepEqual(
      Object.fromEntries(
        (all.body() as SearchBody).organic_results.map((item) => [item.name, item.benefit_today])
      ),
      {
        'Sem benefício': false,
        'Vale domingo': false,
        'Vale segunda': true,
        'Vale sempre': true,
        'Vale terça': false,
      }
    )
  })

  test('turns the day at local midnight, not at UTC midnight', async ({ assert }) => {
    const scenario = await createEstablishmentScenario('catalog-benefit-midnight')
    const published = await edition(scenario, 'published')
    const monday = await place(scenario, 'Vale segunda')
    const tuesday = await place(scenario, 'Vale terça')
    await offer(scenario, published.id, monday, { available_weekdays_mask: MONDAY })
    await offer(scenario, published.id, tuesday, { available_weekdays_mask: TUESDAY })
    const availability = new BenefitAvailabilityService(new BenefitOfferRepository())

    // 00:10 UTC on Tuesday is still 21:10 on Monday in São Paulo.
    assert.deepEqual(
      await availability.establishmentsUsableToday(
        scenario.tenant.id,
        DateTime.fromISO('2026-10-13T00:10:00Z')
      ),
      [monday.id]
    )
    // 02:59 UTC is 23:59 there: still Monday.
    assert.deepEqual(
      await availability.establishmentsUsableToday(
        scenario.tenant.id,
        DateTime.fromISO('2026-10-13T02:59:30Z')
      ),
      [monday.id]
    )
    // 03:00 UTC is midnight there: Tuesday begins.
    assert.deepEqual(
      await availability.establishmentsUsableToday(
        scenario.tenant.id,
        DateTime.fromISO('2026-10-13T03:00:00Z')
      ),
      [tuesday.id]
    )
  })

  test('leaves out paused editions and offers, closed windows and a lunch already over', async ({
    client,
    assert,
    cleanup,
  }) => {
    // 15:00 on Monday in São Paulo.
    freeze('2026-10-12T18:00:00Z', cleanup)
    const scenario = await createEstablishmentScenario('catalog-benefit-rules')
    const published = await edition(scenario, 'published')
    const paused = await edition(scenario, 'paused')
    const valid = await place(scenario, 'Válido')
    const pausedEdition = await place(scenario, 'Edição pausada')
    const pausedOffer = await place(scenario, 'Oferta pausada')
    const lunch = await place(scenario, 'Almoço encerrado')
    const dinner = await place(scenario, 'Jantar de hoje')
    const expired = await place(scenario, 'Oferta vencida')
    const closed = await place(scenario, 'Fechado de vez')
    await offer(scenario, published.id, valid)
    await offer(scenario, paused.id, pausedEdition)
    await offer(scenario, published.id, pausedOffer, {}, 'paused')
    await offer(scenario, published.id, lunch, {
      daily_start_time: '11:00',
      daily_end_time: '14:00',
    })
    await offer(scenario, published.id, dinner, {
      daily_start_time: '18:00',
      daily_end_time: '23:00',
    })
    await offer(scenario, published.id, expired, {
      starts_at: DateTime.fromISO('2026-10-02T03:00:00Z'),
      ends_at: DateTime.fromISO('2026-10-12T15:00:00Z'),
    })
    await offer(scenario, published.id, closed)
    closed.business_status = 'permanently_closed'
    await closed.save()

    const response = await search(client, scenario, { benefit_today: true })

    response.assertStatus(200)
    assert.deepEqual(names(response), ['Jantar de hoje', 'Válido'])
    assert.isTrue(
      (response.body() as SearchBody).organic_results.every((item) => item.benefit_today)
    )
  })

  test('combines with an order and narrows the pages', async ({ client, assert, cleanup }) => {
    freeze('2026-10-12T18:00:00Z', cleanup)
    const scenario = await createEstablishmentScenario('catalog-benefit-sorted')
    const published = await edition(scenario, 'published')
    const near = await place(scenario, 'Perto com benefício', {
      at: { latitude: -23.311, longitude: -51.163 },
    })
    await place(scenario, 'Mais perto sem benefício', {
      at: { latitude: -23.3105, longitude: -51.1628 },
    })
    const far = await place(scenario, 'Longe com benefício', {
      at: { latitude: -23.33, longitude: -51.2 },
    })
    await offer(scenario, published.id, near)
    await offer(scenario, published.id, far)

    const response = await search(client, scenario, {
      benefit_today: true,
      sort: 'distance',
      ...ORIGIN,
    })

    response.assertStatus(200)
    assert.equal(response.body().meta.total, 2)
    assert.deepEqual(names(response), ['Perto com benefício', 'Longe com benefício'])
  })
})

test.group('Public catalog pages and the new orders', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a page shows "nearest first" as relevance and never reads a position', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('catalog-page-distance')
    await place(scenario, 'Bravo', { at: { latitude: -23.311, longitude: -51.163 } })
    await place(scenario, 'Alfa', { at: { latitude: -23.33, longitude: -51.2 } })

    const html = await client
      .get(`/cidades/${scenario.city.slug}`)
      .qs({ sort: 'distance', ...ORIGIN })
      .headers(publicHeaders(scenario))

    html.assertStatus(200)
    const catalog = inertiaProps(html).catalog
    assert.equal(catalog.query.sort, 'relevance')
    assert.deepEqual(
      catalog.organic_results.map((item: { name: string }) => item.name),
      ['Alfa', 'Bravo']
    )
    // Inertia echoes the address it was given; the catalogue itself never read it.
    assert.notInclude(JSON.stringify(catalog), String(ORIGIN.lat))
    assert.notInclude(JSON.stringify(catalog), String(ORIGIN.lng))
  })

  test('a page keeps the rating order and "Vale hoje" in its query', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('catalog-page-rating')
    await place(scenario, 'Sem nota')
    await place(scenario, 'Nota 4,5', { reviews: { count: 2, average: 4.5 } })

    const html = await client
      .get(`/cidades/${scenario.city.slug}`)
      .qs({ sort: 'rating' })
      .headers(publicHeaders(scenario))

    html.assertStatus(200)
    const catalog = inertiaProps(html).catalog
    assert.equal(catalog.query.sort, 'rating')
    assert.deepEqual(
      catalog.organic_results.map((item: { name: string }) => item.name),
      ['Nota 4,5', 'Sem nota']
    )

    const filtered = await client
      .get(`/cidades/${scenario.city.slug}`)
      .qs({ benefit_today: 'true' })
      .headers(publicHeaders(scenario))
    filtered.assertStatus(200)
    const filteredProps = inertiaProps(filtered)
    assert.isTrue(filteredProps.catalog.query.benefit_today)
    assert.deepEqual(filteredProps.catalog.organic_results, [])
    // A narrowed search is not the city's landing view: no agenda behind it.
    assert.isNull(filteredProps.city_agenda)
  })
})
