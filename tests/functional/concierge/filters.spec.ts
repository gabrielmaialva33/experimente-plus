import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import {
  EstablishmentEventFactory,
  EstablishmentExperienceFactory,
  EstablishmentReviewFactory,
} from '#database/factories/index'
import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import CatalogGroundingRepository from '#modules/concierge/repositories/catalog_grounding_repository'
import ConciergeProviderFactory from '#modules/concierge/services/concierge_provider_factory'
import type Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import EstablishmentRevisionHour from '#modules/establishments/models/establishment_revision_hour'
import City from '#modules/geography/models/city'
import IRoles from '#modules/roles/interfaces/role_interface'
import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryFamily from '#modules/taxonomy/models/category_family'
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

const names = (items: Array<{ name: string }>) => items.map((item) => item.name)

/**
 * A provider that cites the first item it was offered — or the reference it
 * is told to — and keeps every prompt. The prompts are the point: a filter
 * promises what the model never sees, and only a provider we own can say so.
 */
class RecordingFactory extends ConciergeProviderFactory {
  calls = 0
  prompts: string[] = []
  cite: string[] | null = null

  make(): IConcierge.Provider {
    return {
      name: 'recording',
      complete: async (request) => {
        this.calls += 1
        this.prompts.push(request.user)
        const first = /^- (\w+:\d+) /m.exec(request.user)?.[1]
        const refs = this.cite ?? [first]
        return {
          model: request.model,
          content: JSON.stringify({
            intro: 'Sugestão',
            steps: refs.map((ref) => ({ ref, why: 'Combina' })),
          }),
        }
      },
    }
  }

  models() {
    return ['recording-model']
  }
}

async function refresh(scenario: EstablishmentScenario, establishment: Establishment) {
  await db.rawQuery('SELECT catalog_refresh_establishment(?, ?)', [
    scenario.tenant.id,
    establishment.id,
  ])
}

/** A place filed under another category, through its published revision. */
async function categorise(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  category: Category
) {
  await db
    .from('establishment_revision_categories')
    .where('tenant_id', scenario.tenant.id)
    .where('revision_id', establishment.published_revision_id!)
    .update({ category_id: category.id })
  await refresh(scenario, establishment)
}

/**
 * The five families of the operation's taxonomy, by the slugs the kind
 * mapping reads, each with one category. The scenario's own family has a
 * suffixed slug, so its places belong to no kind.
 */
async function taxonomy(scenario: EstablishmentScenario) {
  const category = async (familySlug: string, name: string) => {
    const family = await CategoryFamily.create({
      tenant_id: scenario.tenant.id,
      name,
      slug: familySlug,
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
    })
    return Category.create({
      tenant_id: scenario.tenant.id,
      family_id: family.id,
      parent_id: null,
      name,
      slug: `${familySlug}-categoria`,
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
      allows_always_open: false,
    })
  }

  return {
    food: await category('comer-e-beber', 'Comer & Beber'),
    culture: await category('cultura-e-lazer', 'Cultura & Lazer'),
    outdoors: await category('ar-livre-e-esportes', 'Ar livre & Esportes'),
    wellbeing: await category('bem-estar-e-estilo', 'Bem-estar & Estilo'),
    local: await category('servicos-locais', 'Serviços locais'),
  }
}

async function placeIn(scenario: EstablishmentScenario, name: string, category: Category) {
  const place = await createPublishedEstablishment(scenario, name)
  await categorise(scenario, place, category)
  return place
}

async function alwaysOpen(scenario: EstablishmentScenario, establishment: Establishment) {
  await db
    .from('establishment_revisions')
    .where('id', establishment.published_revision_id!)
    .update({ availability_type: 'always_open' })
  await refresh(scenario, establishment)
}

async function rate(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  ratings: number[]
) {
  for (const rating of ratings) {
    const author = await createUser({ prefix: 'cf-rater', tenant: scenario.tenant })
    await EstablishmentReviewFactory.merge({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      user_id: author.id,
      rating,
      status: 'published',
    }).create()
  }
}

/** The "Ticket médio" field of the operation's attribute form. */
async function ticketField(scenario: EstablishmentScenario) {
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
    validation_rules: {},
  })
}

async function ticket(
  scenario: EstablishmentScenario,
  field: CategoryAttributeDefinition,
  establishment: Establishment,
  reais: number
) {
  await EstablishmentRevisionAttributeValue.create({
    tenant_id: scenario.tenant.id,
    revision_id: establishment.published_revision_id!,
    attribute_definition_id: field.id,
    value_decimal: reais,
  })
  await refresh(scenario, establishment)
}

async function event(
  scenario: EstablishmentScenario,
  host: Establishment,
  title: string,
  startsAt: DateTime,
  hours = 3
) {
  return EstablishmentEventFactory.merge({
    tenant_id: scenario.tenant.id,
    establishment_id: host.id,
    created_by: scenario.owner.id,
    title,
    starts_at: startsAt,
    ends_at: startsAt.plus({ hours }),
  })
    .apply('published')
    .create()
}

async function experience(scenario: EstablishmentScenario, host: Establishment, title: string) {
  return EstablishmentExperienceFactory.merge({
    tenant_id: scenario.tenant.id,
    establishment_id: host.id,
    created_by: scenario.owner.id,
    title,
  })
    .apply('published')
    .create()
}

const ground = (
  scenario: EstablishmentScenario,
  filters: IConcierge.Filters | null,
  now = new Date(),
  city: string | null = null
) => new CatalogGroundingRepository().forQuestion(scenario.tenant.id, city, 20, now, [], filters)

test.group('Concierge filters — grounding', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('no filter, or an empty one, grounds exactly as before', async ({ assert }) => {
    const scenario = await createEstablishmentScenario('cf-none')
    await createPublishedEstablishment(scenario, 'Alfa Café')
    await createPublishedEstablishment(scenario, 'Beta Bistrô')

    const plain = await new CatalogGroundingRepository().forQuestion(scenario.tenant.id, null, 20)
    assert.deepEqual(names(plain.offered), ['Alfa Café', 'Beta Bistrô'])

    for (const filters of [null, {}, { kind: [], price: [] }, { open_now: false }]) {
      const filtered = await ground(scenario, filters)
      assert.deepEqual(filtered, plain, JSON.stringify(filters))
    }
  })

  test('open now follows the published hours in the city timezone', async ({ assert }) => {
    const scenario = await createEstablishmentScenario('cf-hours')
    const scheduled = await createPublishedEstablishment(scenario, 'Alfa Horário')
    await createPublishedEstablishment(scenario, 'Beta Sem Horário')
    const always = await createPublishedEstablishment(scenario, 'Gama Sempre Aberto')
    await alwaysOpen(scenario, always)

    // A Monday in São Paulo (UTC-3), open from 10:00 to 18:00 local time.
    const monday = DateTime.fromISO('2026-10-12T12:00', { zone: 'America/Sao_Paulo' })
    await EstablishmentRevisionHour.create({
      tenant_id: scenario.tenant.id,
      revision_id: scheduled.published_revision_id!,
      weekday: monday.weekday % 7,
      opens_at: '10:00',
      closes_at: '18:00',
      spans_next_day: false,
      sort_order: 0,
    })
    await refresh(scenario, scheduled)

    const at = (local: string) =>
      DateTime.fromISO(`2026-10-12T${local}`, { zone: 'America/Sao_Paulo' }).toJSDate()

    const noon = await ground(scenario, { open_now: true }, at('12:00'))
    assert.deepEqual(names(noon.offered), ['Alfa Horário', 'Gama Sempre Aberto'])

    // 09:30 local is 12:30 UTC, inside 10:00–18:00 if the hours were read in UTC.
    const early = await ground(scenario, { open_now: true }, at('09:30'))
    assert.deepEqual(names(early.offered), ['Gama Sempre Aberto'])

    const night = await ground(scenario, { open_now: true }, at('20:00'))
    assert.deepEqual(names(night.offered), ['Gama Sempre Aberto'])
  })

  test('open now keeps events on now and the experiences of places open now', async ({
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('cf-content')
    const closed = await createPublishedEstablishment(scenario, 'Alfa Fechado')
    const open = await createPublishedEstablishment(scenario, 'Beta Aberto')
    await alwaysOpen(scenario, open)
    await createPublishedEstablishment(scenario, 'Gama Fechado')

    const now = DateTime.utc()
    await event(scenario, closed, 'Show acontecendo', now.minus({ hours: 1 }))
    await event(scenario, closed, 'Show de amanhã', now.plus({ days: 1 }))
    await experience(scenario, closed, 'Oficina no lugar fechado')
    await experience(scenario, open, 'Oficina no lugar aberto')

    const all = await ground(scenario, null, now.toJSDate())
    assert.sameMembers(names(all.offered), [
      'Alfa Fechado',
      'Beta Aberto',
      'Gama Fechado',
      'Show acontecendo',
      'Show de amanhã',
      'Oficina no lugar fechado',
      'Oficina no lugar aberto',
    ])

    const openNow = await ground(scenario, { open_now: true }, now.toJSDate())
    assert.sameMembers(names(openNow.offered), [
      'Beta Aberto',
      'Oficina no lugar aberto',
      'Show acontecendo',
    ])
    // A place the filter excluded is withheld from the prose check, like any
    // place the question did not offer — unless it is in sight as a host.
    assert.include(openNow.withheld, 'Gama Fechado')
    assert.notInclude(openNow.withheld, 'Alfa Fechado')
  })

  test('kind maps food, leisure and services onto the families', async ({ assert }) => {
    const scenario = await createEstablishmentScenario('cf-kind')
    const families = await taxonomy(scenario)
    await placeIn(scenario, 'Café da Praça', families.food)
    await placeIn(scenario, 'Cinema Central', families.culture)
    await placeIn(scenario, 'Parque das Trilhas', families.outdoors)
    await placeIn(scenario, 'Estúdio Zen', families.wellbeing)
    await placeIn(scenario, 'Floricultura Ipê', families.local)
    // The scenario's own family is not one of the mapped slugs.
    await createPublishedEstablishment(scenario, 'Lugar Sem Tipo')

    const of = async (kind: IConcierge.FilterKind[]) => {
      const { offered } = await ground(scenario, { kind })
      return names(offered)
    }

    assert.deepEqual(await of(['food']), ['Café da Praça'])
    assert.deepEqual(await of(['leisure']), ['Cinema Central', 'Parque das Trilhas'])
    assert.deepEqual(await of(['services']), ['Estúdio Zen', 'Floricultura Ipê'])
    assert.deepEqual(await of(['food', 'services']), [
      'Café da Praça',
      'Estúdio Zen',
      'Floricultura Ipê',
    ])
    assert.lengthOf(await of([]), 6)
  })

  test('min rating reads the public average, and no reviews is no average', async ({ assert }) => {
    const scenario = await createEstablishmentScenario('cf-rating')
    const loved = await createPublishedEstablishment(scenario, 'Alfa Querido')
    const fair = await createPublishedEstablishment(scenario, 'Beta Mediano')
    await createPublishedEstablishment(scenario, 'Gama Novo')
    await rate(scenario, loved, [5, 4])
    await rate(scenario, fair, [3, 4])

    const four = await ground(scenario, { min_rating: 4 })
    assert.deepEqual(names(four.offered), ['Alfa Querido'])

    const threeAndAHalf = await ground(scenario, { min_rating: 3.5 })
    assert.deepEqual(names(threeAndAHalf.offered), ['Alfa Querido', 'Beta Mediano'])

    const one = await ground(scenario, { min_rating: 1 })
    assert.notInclude(names(one.offered), 'Gama Novo')
  })

  test('price buckets read the published Ticket médio', async ({ assert }) => {
    const scenario = await createEstablishmentScenario('cf-price')
    const field = await ticketField(scenario)
    await ticket(scenario, field, await createPublishedEstablishment(scenario, 'A Café'), 38)
    await ticket(scenario, field, await createPublishedEstablishment(scenario, 'B Bistrô'), 50)
    await ticket(scenario, field, await createPublishedEstablishment(scenario, 'C Cantina'), 65)
    await ticket(scenario, field, await createPublishedEstablishment(scenario, 'D Degustação'), 120)
    await createPublishedEstablishment(scenario, 'E Sem Ticket')

    const of = async (price: IConcierge.PriceBucket[]) => {
      const { offered } = await ground(scenario, { price })
      return names(offered)
    }

    // Fifty is "up to 50"; nothing falls between two buckets.
    assert.deepEqual(await of(['up_to_50']), ['A Café', 'B Bistrô'])
    assert.deepEqual(await of(['50_100']), ['C Cantina'])
    assert.deepEqual(await of(['over_100']), ['D Degustação'])
    assert.deepEqual(await of(['up_to_50', 'over_100']), ['A Café', 'B Bistrô', 'D Degustação'])
    assert.deepEqual(await of(['up_to_50', '50_100', 'over_100']), [
      'A Café',
      'B Bistrô',
      'C Cantina',
      'D Degustação',
    ])
  })

  test('filters combine with each other: every one must hold', async ({ assert }) => {
    const scenario = await createEstablishmentScenario('cf-all')
    const families = await taxonomy(scenario)
    const field = await ticketField(scenario)

    const match = await placeIn(scenario, 'Alfa Tudo Certo', families.food)
    await alwaysOpen(scenario, match)
    await rate(scenario, match, [5])
    await ticket(scenario, field, match, 45)

    const closed = await placeIn(scenario, 'Beta Fechado', families.food)
    await rate(scenario, closed, [5])
    await ticket(scenario, field, closed, 45)

    const pricey = await placeIn(scenario, 'Gama Caro', families.food)
    await alwaysOpen(scenario, pricey)
    await rate(scenario, pricey, [5])
    await ticket(scenario, field, pricey, 150)

    const leisure = await placeIn(scenario, 'Delta Lazer', families.culture)
    await alwaysOpen(scenario, leisure)
    await rate(scenario, leisure, [5])
    await ticket(scenario, field, leisure, 45)

    const filtered = await ground(scenario, {
      open_now: true,
      kind: ['food'],
      min_rating: 4,
      price: ['up_to_50'],
    })
    assert.deepEqual(names(filtered.offered), ['Alfa Tudo Certo'])
  })
})

test.group('Concierge filters — routes', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  let provider: RecordingFactory
  group.each.setup(() => {
    provider = new RecordingFactory()
    app.container.swap(ConciergeProviderFactory, () => provider)
    return () => app.container.restore(ConciergeProviderFactory)
  })

  async function operation(prefix: string) {
    const scenario = await createEstablishmentScenario(prefix)
    const families = await taxonomy(scenario)
    const cafe = await placeIn(scenario, 'Alfa Café', families.food)
    const museum = await placeIn(scenario, 'Beta Museu', families.culture)
    const explorer = await createUser({ prefix: `${prefix}-explorer`, tenant: scenario.tenant })
    return { scenario, families, cafe, museum, explorer, headers: tenantHeader(scenario.tenant.id) }
  }

  test('both routes take the filters and narrow the reply', async ({ client, assert }) => {
    const { scenario, explorer, headers } = await operation('cf-routes')
    const body = { question: 'Onde ir hoje?', filters: { kind: ['leisure'] } }

    const visitor = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .json(body)
    const personal = await client
      .post('/api/v1/me/concierge')
      .headers(headers)
      .loginAs(explorer)
      .json(body)

    for (const reply of [visitor, personal]) {
      reply.assertStatus(200)
      assert.equal(reply.body().outcome, 'grounded')
      assert.deepEqual(names(reply.body().items), ['Beta Museu'])
    }
    for (const prompt of provider.prompts) {
      assert.include(prompt, 'Beta Museu')
      assert.notInclude(prompt, 'Alfa Café')
    }
  })

  test('refuses a filter outside its vocabulary or range on both routes', async ({ client }) => {
    const { scenario, explorer, headers } = await operation('cf-invalid')

    for (const filters of [
      { kind: ['nightlife'] },
      { kind: 'food' },
      { kind: ['food', 'food'] },
      { price: ['cheap'] },
      { price: ['up_to_50', 'up_to_50'] },
      { min_rating: 0 },
      { min_rating: 6 },
      { min_rating: 'four' },
      { open_now: 'sometimes' },
      'food',
    ]) {
      const body = { question: 'Onde ir hoje?', filters }
      const visitor = await client
        .post('/api/v1/catalog/concierge')
        .headers(publicHeaders(scenario))
        .json(body)
      visitor.assertStatus(422)
      const personal = await client
        .post('/api/v1/me/concierge')
        .headers(headers)
        .loginAs(explorer)
        .json(body)
      personal.assertStatus(422)
    }
  })

  test('filters and city narrow together', async ({ client, assert }) => {
    const { scenario, families } = await operation('cf-city')
    // No model: the degraded reply lists everything that survived.
    app.container.restore(ConciergeProviderFactory)
    const elsewhere = await City.create({
      tenant_id: scenario.tenant.id,
      region_id: scenario.region.id,
      name: 'Outra Cidade',
      slug: `outra-cidade-${scenario.tenant.id}`,
      state_code: 'PR',
      country_code: 'BR',
      ibge_code: null,
      timezone: 'America/Sao_Paulo',
      latitude: -23.3,
      longitude: -51.1,
      sort_order: 1,
      is_active: true,
    })
    await placeIn({ ...scenario, city: elsewhere }, 'Gama Café', families.food)

    const everywhere = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .json({ question: 'Onde tomar um café?', filters: { kind: ['food'] } })
    assert.sameMembers(names(everywhere.body().items), ['Alfa Café', 'Gama Café'])

    const here = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .json({
        question: 'Onde tomar um café?',
        city: scenario.city.slug,
        filters: { kind: ['food'] },
      })
    assert.deepEqual(names(here.body().items), ['Alfa Café'])

    const there = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .json({ question: 'Onde tomar um café?', city: elsewhere.slug, filters: { kind: ['food'] } })
    assert.deepEqual(names(there.body().items), ['Gama Café'])
  })

  test('a filter that leaves nothing answers with no items and no model', async ({
    client,
    assert,
  }) => {
    const { scenario, explorer, headers } = await operation('cf-empty')

    const visitor = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .json({ question: 'Onde ir hoje?', filters: { kind: ['services'] } })
    const personal = await client
      .post('/api/v1/me/concierge')
      .headers(headers)
      .loginAs(explorer)
      .json({ question: 'Onde ir hoje?', filters: { open_now: true, min_rating: 4 } })

    for (const reply of [visitor, personal]) {
      reply.assertStatus(200)
      assert.deepEqual(reply.body(), {
        outcome: 'degraded',
        text: null,
        items: [],
        model: null,
        personalized: false,
      })
    }
    assert.equal(provider.calls, 0)
  })

  test('a citation of a place the filter excluded is removed', async ({ client, assert }) => {
    const { scenario, cafe, museum } = await operation('cf-citation')
    provider.cite = [`establishment:${cafe.id}`, `establishment:${museum.id}`]

    const reply = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .json({ question: 'Onde ir hoje?', filters: { kind: ['leisure'] } })

    assert.equal(reply.body().outcome, 'grounded')
    assert.deepEqual(names(reply.body().items), ['Beta Museu'])
    assert.notInclude(reply.body().text, 'Alfa Café')
  })

  test('filters do not bypass the daily quota', async ({ client, assert }) => {
    const { scenario, explorer, headers } = await operation('cf-quota')
    const admin = await createUser({
      prefix: 'cf-quota-admin',
      tenant: scenario.tenant,
      tenantRole: 'admin',
      globalRole: IRoles.Slugs.ADMIN,
    })
    await client
      .put('/api/v1/admin/concierge-policy')
      .headers(headers)
      .loginAs(admin)
      .json({ daily_questions_per_person: 1 })

    const outcomes = []
    for (const filters of [{ kind: ['food'] }, { kind: ['leisure'] }]) {
      const reply = await client
        .post('/api/v1/me/concierge')
        .headers(headers)
        .loginAs(explorer)
        .json({ question: 'Onde ir hoje?', filters })
      reply.assertStatus(200)
      outcomes.push(reply.body().outcome)
      if (reply.body().outcome === 'degraded') {
        // Past the quota the catalogue still answers, filtered.
        assert.deepEqual(names(reply.body().items), ['Beta Museu'])
      }
    }
    assert.deepEqual(outcomes, ['grounded', 'degraded'])
    assert.equal(provider.calls, 1)
  })

  test('filters do not bypass the topic refusal or a switched-off assistant', async ({
    client,
    assert,
  }) => {
    const { scenario, explorer, headers } = await operation('cf-guard')

    const refused = await client
      .post('/api/v1/me/concierge')
      .headers(headers)
      .loginAs(explorer)
      .json({ question: 'preciso de um advogado urgente', filters: { kind: ['services'] } })
    assert.equal(refused.body().outcome, 'refused')
    assert.lengthOf(refused.body().items, 0)

    const admin = await createUser({
      prefix: 'cf-guard-admin',
      tenant: scenario.tenant,
      tenantRole: 'admin',
      globalRole: IRoles.Slugs.ADMIN,
    })
    await client
      .put('/api/v1/admin/concierge-policy')
      .headers(headers)
      .loginAs(admin)
      .json({ enabled: false })

    const off = await client
      .post('/api/v1/catalog/concierge')
      .headers(publicHeaders(scenario))
      .json({ question: 'Onde ir hoje?', filters: { kind: ['food'] } })
    assert.equal(off.body().outcome, 'degraded')
    assert.deepEqual(names(off.body().items), ['Alfa Café'])

    assert.equal(provider.calls, 0)
  })

  test('interests reorder only what survived the filters', async ({ client, assert }) => {
    const { scenario, families, explorer, headers } = await operation('cf-interests')
    await placeIn(scenario, 'Zeta Parque', families.outdoors)
    await client
      .put('/api/v1/me/interests')
      .headers(headers)
      .loginAs(explorer)
      .json({ category_slugs: [families.food.slug] })
    app.container.restore(ConciergeProviderFactory)

    const reply = await client
      .post('/api/v1/me/concierge')
      .headers(headers)
      .loginAs(explorer)
      .json({ question: 'Onde ir hoje?', filters: { kind: ['leisure'] } })

    assert.isTrue(reply.body().personalized)
    assert.deepEqual(names(reply.body().items), ['Beta Museu', 'Zeta Parque'])
  })
})
