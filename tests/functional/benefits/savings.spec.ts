import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import testUtils from '@adonisjs/core/services/test_utils'
import type { Assert } from '@japa/assert'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { parse } from 'yaml'

import {
  BenefitAccessFactory,
  BenefitEditionFactory,
  BenefitOfferFactory,
  BenefitRedemptionFactory,
  CategoryAttributeDefinitionFactory,
  EstablishmentFactory,
  EstablishmentRevisionAttributeValueFactory,
  EstablishmentRevisionFactory,
  UserFactory,
} from '#database/factories/index'
import { createBenefitFlowScenario } from '#database/factories/scenarios/benefit_flow_factory'
import type BenefitAccess from '#modules/benefits/models/benefit_access'
import type BenefitEdition from '#modules/benefits/models/benefit_edition'
import type BenefitOffer from '#modules/benefits/models/benefit_offer'
import type Establishment from '#modules/establishments/models/establishment'
import type User from '#modules/users/models/user'

type Scenario = Awaited<ReturnType<typeof createBenefitFlowScenario>>

/** A published place of the scenario's organization, in its city. */
async function place(scenario: Scenario, name: string, slug: string) {
  const establishment = await EstablishmentFactory.merge({
    tenant_id: scenario.tenant.id,
    organization_id: scenario.organization.id,
    created_by: scenario.users.partner.id,
  }).create()
  const revision = await EstablishmentRevisionFactory.apply('approved')
    .merge({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      city_id: scenario.geography.city.id,
      public_name: name,
      slug,
      created_by: scenario.users.partner.id,
      reviewed_by: scenario.users.admin.id,
    })
    .create()
  establishment.published_revision_id = revision.id
  await establishment.save()
  return { establishment, revision, name }
}

/** The "Ticket médio" of the scenario's category, as the demo taxonomy defines it. */
async function averageTicketDefinition(scenario: Scenario, overrides = {}) {
  return CategoryAttributeDefinitionFactory.merge({
    tenant_id: scenario.tenant.id,
    category_id: scenario.taxonomy.category.id,
    key: 'average_ticket',
    name: 'Ticket médio',
    description: 'Valor médio por pessoa, em reais.',
    data_type: 'decimal',
    unit: 'BRL',
    is_filterable: false,
    ...overrides,
  }).create()
}

async function setTicket(
  scenario: Scenario,
  revisionId: number,
  definitionId: number,
  reais: number
) {
  return EstablishmentRevisionAttributeValueFactory.merge({
    tenant_id: scenario.tenant.id,
    revision_id: revisionId,
    attribute_definition_id: definitionId,
    value_boolean: null,
    value_decimal: reais,
  }).create()
}

async function pastEdition(scenario: Scenario, name: string, startsAt: string, endsAt: string) {
  return BenefitEditionFactory.apply('published')
    .merge({
      tenant_id: scenario.tenant.id,
      city_id: scenario.geography.city.id,
      name,
      sales_starts_at: DateTime.fromISO(startsAt).minus({ days: 30 }),
      sales_ends_at: DateTime.fromISO(endsAt),
      usage_starts_at: DateTime.fromISO(startsAt),
      usage_ends_at: DateTime.fromISO(endsAt),
      created_by: scenario.users.admin.id,
    })
    .create()
}

type OfferState = 'percentage' | 'fixedAmount' | 'complimentaryItem' | 'buyOneGetOne'

async function offer(
  scenario: Scenario,
  edition: BenefitEdition,
  establishment: Establishment,
  state: OfferState,
  values: { discount_percentage?: number; discount_amount_cents?: number } = {}
) {
  const created = await BenefitOfferFactory.apply(state)
    .apply('active')
    .merge({
      tenant_id: scenario.tenant.id,
      edition_id: edition.id,
      establishment_id: establishment.id,
      max_redemptions_per_access: 3,
      created_by: scenario.users.partner.id,
    })
    .create()
  // The type's state draws a random value; the test names the one it reads.
  if (Object.keys(values).length > 0) {
    created.merge(values)
    await created.save()
  }
  return created
}

async function access(scenario: Scenario, edition: BenefitEdition, holder: User) {
  return BenefitAccessFactory.merge({
    tenant_id: scenario.tenant.id,
    edition_id: edition.id,
    user_id: holder.id,
    granted_by: scenario.users.admin.id,
  }).create()
}

/** One use of `used` through `pass`, as the counter would have recorded it. */
async function use(
  scenario: Scenario,
  pass: BenefitAccess,
  used: BenefitOffer,
  placeName: string,
  redeemedAt: DateTime,
  number = 1
) {
  return BenefitRedemptionFactory.merge({
    tenant_id: scenario.tenant.id,
    access_id: pass.id,
    edition_id: used.edition_id,
    offer_id: used.id,
    establishment_id: used.establishment_id,
    organization_id: scenario.organization.id,
    user_id: pass.user_id,
    redeemed_by: scenario.users.partner.id,
    redemption_number: number,
    edition_name_snapshot: 'Edição do teste',
    offer_title_snapshot: used.title,
    benefit_type_snapshot: used.benefit_type,
    offer_terms_snapshot: used.terms,
    establishment_name_snapshot: placeName,
    redeemed_at: redeemedAt,
  }).create()
}

async function savingsOf(client: ApiClient, user: User, tenantId: number) {
  return client.get('/api/v1/me/savings').header('x-tenant-id', String(tenantId)).loginAs(user)
}

type Operation = {
  security?: unknown
  responses: Record<
    string,
    {
      $ref?: string
      headers: Record<string, { $ref: string }>
      content: Record<string, { schema: Schema }>
    }
  >
}

type Schema = {
  $ref?: string
  type?: string
  const?: unknown
  required?: string[]
  properties?: Record<string, Schema>
  items?: Schema
  additionalProperties?: boolean
}

/**
 * Walks a response through its documented schema: every object carries
 * exactly the documented properties, all of them required, so the contract the
 * app is generated from cannot drift from what the route answers.
 */
function assertDocumentedShape(
  assert: Assert,
  schemas: Record<string, Schema>,
  schema: Schema,
  value: unknown,
  path: string
) {
  const resolved = schema.$ref ? schemas[schema.$ref.replace('#/components/schemas/', '')] : schema
  if (resolved.const !== undefined) assert.equal(value, resolved.const, path)
  if (resolved.type === 'array') {
    assert.isArray(value, path)
    for (const [index, item] of (value as unknown[]).entries()) {
      assertDocumentedShape(assert, schemas, resolved.items!, item, `${path}[${index}]`)
    }
    return
  }
  if (resolved.type !== 'object') return
  const documented = Object.keys(resolved.properties ?? {})
  assert.isFalse(resolved.additionalProperties, path)
  assert.sameMembers(resolved.required ?? [], documented, `${path} requires every property`)
  assert.sameMembers(Object.keys(value as object), documented, path)
  for (const key of documented) {
    assertDocumentedShape(
      assert,
      schemas,
      resolved.properties![key],
      (value as Record<string, unknown>)[key],
      `${path}.${key}`
    )
  }
}

test.group('Benefits savings', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('requires a session and answers privately with zeros before any use', async ({
    assert,
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'savings-empty' })

    const anonymous = await client
      .get('/api/v1/me/savings')
      .header('x-tenant-id', String(scenario.tenant.id))
    anonymous.assertStatus(401)

    const response = await savingsOf(client, scenario.users.holder, scenario.tenant.id)
    response.assertStatus(200)
    response.assertHeader('cache-control', 'private, no-store')
    response.assertHeader('x-robots-tag', 'noindex, nofollow')
    response.assertHeader('referrer-policy', 'no-referrer')
    assert.deepEqual(response.body(), {
      currency: 'BRL',
      current: {
        editions: [],
        places_visited: 0,
        benefits_used: 0,
        savings_exact_cents: 0,
        savings_estimated_cents: 0,
        uses_without_estimate: 0,
        top_places: [],
      },
      past: [],
    })
  })

  test('adds fixed discounts exactly, estimates percentages from the ticket and counts the rest as uses', async ({
    assert,
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'savings-current' })
    const { edition, access: pass, users } = scenario
    const ticket = await averageTicketDefinition(scenario)
    const cafe = await place(scenario, 'Café Aurora', 'cafe-aurora-savings-current')
    const bistro = await place(scenario, 'Bistrô Ipê', 'bistro-ipe-savings-current')
    const bar = await place(scenario, 'Bar Sem Ticket', 'bar-sem-ticket-savings-current')
    // R$ 42,50 per person at the café; the bar never filled its "Ticket médio".
    await setTicket(scenario, cafe.revision.id, ticket.id, 42.5)
    // A ticket on the place of a fixed discount changes nothing: that value is exact.
    await setTicket(scenario, bistro.revision.id, ticket.id, 90)

    const percentage = await offer(scenario, edition, cafe.establishment, 'percentage', {
      discount_percentage: 20,
    })
    const fixed = await offer(scenario, edition, bistro.establishment, 'fixedAmount', {
      discount_amount_cents: 1500,
    })
    const withoutTicket = await offer(scenario, edition, bar.establishment, 'percentage', {
      discount_percentage: 10,
    })

    const now = DateTime.utc()
    // The scenario's own offer: buy one, get one — a use without a money value.
    await use(scenario, pass, scenario.offer, 'Mesa Norte — Londrina', now.minus({ hours: 5 }))
    await use(scenario, pass, percentage, cafe.name, now.minus({ hours: 4 }), 1)
    await use(scenario, pass, percentage, cafe.name, now.minus({ hours: 3 }), 2)
    await use(scenario, pass, fixed, bistro.name, now.minus({ hours: 2 }))
    await use(scenario, pass, withoutTicket, bar.name, now.minus({ hours: 1 }))

    const response = await savingsOf(client, users.holder, scenario.tenant.id)
    response.assertStatus(200)
    const { current, past } = response.body()

    assert.deepEqual(current.editions, [
      {
        id: edition.id,
        name: edition.name,
        year: edition.usage_starts_at.setZone('America/Sao_Paulo').year,
      },
    ])
    assert.equal(current.places_visited, 4)
    assert.equal(current.benefits_used, 5)
    assert.equal(current.savings_exact_cents, 1500)
    // 20% of R$ 42,50, twice.
    assert.equal(current.savings_estimated_cents, 850 * 2)
    assert.equal(current.uses_without_estimate, 1)
    assert.deepEqual(current.top_places, [
      { name: 'Café Aurora', visits: 2 },
      { name: 'Bar Sem Ticket', visits: 1 },
      { name: 'Bistrô Ipê', visits: 1 },
    ])
    assert.deepEqual(past, [])
  })

  test('keeps each closed edition apart, newest first, and still counts uses of a revoked access', async ({
    assert,
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'savings-years' })
    const holder = scenario.users.holder
    const ticket = await averageTicketDefinition(scenario)
    const cafe = await place(scenario, 'Café Aurora', 'cafe-aurora-savings-years')
    await setTicket(scenario, cafe.revision.id, ticket.id, 30)

    const edition2025 = await pastEdition(
      scenario,
      'Experimente Londrina 2025',
      '2025-03-01T03:00:00Z',
      '2025-12-31T23:00:00Z'
    )
    const edition2024 = await pastEdition(
      scenario,
      'Experimente Londrina 2024',
      '2024-03-01T03:00:00Z',
      '2024-12-31T23:00:00Z'
    )
    const fixed2025 = await offer(scenario, edition2025, scenario.establishment, 'fixedAmount', {
      discount_amount_cents: 1000,
    })
    const courtesy2025 = await offer(scenario, edition2025, cafe.establishment, 'complimentaryItem')
    const percentage2024 = await offer(scenario, edition2024, cafe.establishment, 'percentage', {
      discount_percentage: 50,
    })

    // The 2025 package was refunded in full afterwards, which revoked it.
    const pass2025 = await access(scenario, edition2025, holder)
    const pass2024 = await access(scenario, edition2024, holder)
    await use(scenario, pass2025, fixed2025, 'Mesa Norte', DateTime.fromISO('2025-05-10T20:00:00Z'))
    await use(scenario, pass2025, courtesy2025, cafe.name, DateTime.fromISO('2025-06-01T15:00:00Z'))
    await use(
      scenario,
      pass2024,
      percentage2024,
      cafe.name,
      DateTime.fromISO('2024-04-02T15:00:00Z')
    )
    pass2025.merge({
      status: 'revoked',
      revoked_at: DateTime.utc(),
      revocation_reason: 'Confirmed full payment refund',
    })
    await pass2025.save()

    // An edition held but never used leaves no recap.
    const unused = await pastEdition(
      scenario,
      'Experimente Londrina 2023',
      '2023-03-01T03:00:00Z',
      '2023-12-31T23:00:00Z'
    )
    await access(scenario, unused, holder)

    const response = await savingsOf(client, holder, scenario.tenant.id)
    response.assertStatus(200)
    const { current, past } = response.body()

    assert.equal(current.benefits_used, 0)
    assert.deepEqual(current.editions, [])
    assert.deepEqual(past, [
      {
        edition: { id: edition2025.id, name: 'Experimente Londrina 2025', year: 2025 },
        places_visited: 2,
        benefits_used: 2,
        savings_exact_cents: 1000,
        savings_estimated_cents: 0,
        uses_without_estimate: 0,
        top_places: [
          { name: 'Café Aurora', visits: 1 },
          { name: 'Mesa Norte', visits: 1 },
        ],
      },
      {
        edition: { id: edition2024.id, name: 'Experimente Londrina 2024', year: 2024 },
        places_visited: 1,
        benefits_used: 1,
        savings_exact_cents: 0,
        // 50% of R$ 30,00.
        savings_estimated_cents: 1500,
        uses_without_estimate: 0,
        top_places: [{ name: 'Café Aurora', visits: 1 }],
      },
    ])
  })

  test('never reads another person, another operation or a ticket the page hides', async ({
    assert,
    client,
  }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'savings-bounds' })
    const { edition, users } = scenario
    // The ticket exists but the operation keeps it off the public page.
    const hidden = await averageTicketDefinition(scenario, { is_public: false })
    const cafe = await place(scenario, 'Café Aurora', 'cafe-aurora-savings-bounds')
    await setTicket(scenario, cafe.revision.id, hidden.id, 40)
    const percentage = await offer(scenario, edition, cafe.establishment, 'percentage', {
      discount_percentage: 20,
    })
    const bistro = await place(scenario, 'Mesa Norte', 'mesa-norte-savings-bounds')
    const fixed = await offer(scenario, edition, bistro.establishment, 'fixedAmount', {
      discount_amount_cents: 2000,
    })

    // Someone else in the same operation used both.
    const neighbour = await UserFactory.merge({
      email: 'neighbour.savings-bounds@example.test',
      username: 'neighbour_savings_bounds',
    }).create()
    await neighbour.related('tenants').attach({ [scenario.tenant.id]: { role: 'member' } })
    const neighbourPass = await access(scenario, edition, neighbour)
    await use(scenario, neighbourPass, fixed, 'Mesa Norte', DateTime.utc().minus({ hours: 2 }))
    await use(scenario, neighbourPass, percentage, cafe.name, DateTime.utc().minus({ hours: 1 }))

    // The holder used the café once here, and a fixed discount in another operation.
    await use(scenario, scenario.access, percentage, cafe.name, DateTime.utc().minus({ hours: 3 }))
    const elsewhere = await createBenefitFlowScenario({ suffix: 'savings-elsewhere' })
    await users.holder.related('tenants').attach({ [elsewhere.tenant.id]: { role: 'member' } })
    const far = await place(elsewhere, 'Longe Daqui', 'longe-daqui-savings-elsewhere')
    const elsewhereFixed = await offer(
      elsewhere,
      elsewhere.edition,
      far.establishment,
      'fixedAmount',
      {
        discount_amount_cents: 3000,
      }
    )
    const elsewherePass = await access(elsewhere, elsewhere.edition, users.holder)
    await use(elsewhere, elsewherePass, elsewhereFixed, 'Longe Daqui', DateTime.utc())

    const mine = await savingsOf(client, users.holder, scenario.tenant.id)
    mine.assertStatus(200)
    assert.equal(mine.body().current.benefits_used, 1)
    assert.equal(mine.body().current.places_visited, 1)
    assert.equal(mine.body().current.savings_exact_cents, 0)
    assert.equal(mine.body().current.savings_estimated_cents, 0)
    assert.equal(mine.body().current.uses_without_estimate, 1)
    assert.deepEqual(mine.body().current.top_places, [{ name: 'Café Aurora', visits: 1 }])
    assert.notInclude(JSON.stringify(mine.body()), 'Longe Daqui')

    const there = await savingsOf(client, users.holder, elsewhere.tenant.id)
    there.assertStatus(200)
    assert.equal(there.body().current.benefits_used, 1)
    assert.equal(there.body().current.savings_exact_cents, 3000)
    assert.deepEqual(there.body().current.top_places, [{ name: 'Longe Daqui', visits: 1 }])

    const theirs = await savingsOf(client, neighbour, scenario.tenant.id)
    theirs.assertStatus(200)
    assert.equal(theirs.body().current.benefits_used, 2)
    assert.equal(theirs.body().current.savings_exact_cents, 2000)
  })

  test('reads the type each use had, not the one its offer has now', async ({ assert, client }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'savings-snapshot' })
    const bistro = await place(scenario, 'Mesa Norte', 'mesa-norte-savings-snapshot')
    const fixed = await offer(scenario, scenario.edition, bistro.establishment, 'fixedAmount', {
      discount_amount_cents: 1200,
    })
    await use(scenario, scenario.access, fixed, 'Mesa Norte', DateTime.utc().minus({ hours: 1 }))

    // Paused and turned into a courtesy afterwards: the amount of that use is gone.
    fixed.merge({
      status: 'paused',
      benefit_type: 'complimentary_item',
      discount_amount_cents: null,
    })
    await fixed.save()

    const response = await savingsOf(client, scenario.users.holder, scenario.tenant.id)
    response.assertStatus(200)
    assert.equal(response.body().current.benefits_used, 1)
    assert.equal(response.body().current.savings_exact_cents, 0)
    assert.equal(response.body().current.uses_without_estimate, 1)
  })

  test('gives the wallet page the same savings', async ({ assert, client }) => {
    const scenario = await createBenefitFlowScenario({ suffix: 'savings-page' })
    const bistro = await place(scenario, 'Mesa Norte', 'mesa-norte-savings-page')
    const fixed = await offer(scenario, scenario.edition, bistro.establishment, 'fixedAmount', {
      discount_amount_cents: 2500,
    })
    await use(scenario, scenario.access, fixed, 'Mesa Norte', DateTime.utc().minus({ hours: 1 }))

    const response = await client
      .get('/wallet')
      .header('x-tenant-id', String(scenario.tenant.id))
      .loginAs(scenario.users.holder)
      .accept('html')

    response.assertStatus(200)
    response.assertHeader('cache-control', 'private, no-store')
    const match = response
      .text()
      .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
    const page = JSON.parse(match![1]) as {
      component: string
      props: { savings: { current: { savings_exact_cents: number; places_visited: number } } }
    }
    assert.equal(page.component, 'wallet/index')
    assert.equal(page.props.savings.current.savings_exact_cents, 2500)
    assert.equal(page.props.savings.current.places_visited, 1)
  })

  test('answers exactly the documented contract, privately and behind a session', async ({
    assert,
    client,
  }) => {
    const specification = parse(
      await readFile(join(process.cwd(), 'docs/openapi.yaml'), 'utf8')
    ) as {
      paths: Record<string, { get: Operation }>
      components: { schemas: Record<string, Schema> }
    }
    const operation = specification.paths['/api/v1/me/savings'].get
    // No `security` of its own: the document's default, a bearer session.
    assert.notProperty(operation, 'security')
    const success = operation.responses['200']
    for (const [header, reference] of Object.entries({
      'Cache-Control': '#/components/headers/PrivateCacheControl',
      'X-Robots-Tag': '#/components/headers/PrivateRobotsTag',
      'Referrer-Policy': '#/components/headers/PrivateReferrerPolicy',
    })) {
      assert.equal(success.headers[header].$ref, reference)
    }
    assert.equal(operation.responses['401'].$ref, '#/components/responses/UnauthorizedError')

    const scenario = await createBenefitFlowScenario({ suffix: 'savings-contract' })
    const cafe = await place(scenario, 'Café Aurora', 'cafe-aurora-savings-contract')
    const fixed = await offer(scenario, scenario.edition, cafe.establishment, 'fixedAmount', {
      discount_amount_cents: 900,
    })
    await use(scenario, scenario.access, fixed, cafe.name, DateTime.utc().minus({ hours: 1 }))
    const closed = await pastEdition(
      scenario,
      'Experimente Londrina 2025',
      '2025-03-01T03:00:00Z',
      '2025-12-31T23:00:00Z'
    )
    const old = await offer(scenario, closed, cafe.establishment, 'complimentaryItem')
    const oldPass = await access(scenario, closed, scenario.users.holder)
    await use(scenario, oldPass, old, cafe.name, DateTime.fromISO('2025-04-01T15:00:00Z'))

    const response = await savingsOf(client, scenario.users.holder, scenario.tenant.id)
    response.assertStatus(200)
    assert.lengthOf(response.body().past, 1)
    assert.lengthOf(response.body().current.editions, 1)
    assertDocumentedShape(
      assert,
      specification.components.schemas,
      success.content['application/json'].schema,
      response.body(),
      'BenefitSavings'
    )
  })
})
