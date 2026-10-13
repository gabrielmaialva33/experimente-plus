import { randomBytes } from 'node:crypto'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import type { EstablishmentPerformancePageProps } from '#modules/analytics/interfaces/establishment_performance_page'
import EstablishmentPerformanceService from '#modules/analytics/services/establishment_performance_service'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import type Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import IRole from '#modules/roles/interfaces/role_interface'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import type User from '#modules/users/models/user'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import {
  addOrganizationMember,
  createOrganization,
  createUser,
} from '#tests/functional/organizations/helpers'

const ZONE = 'America/Sao_Paulo'
/** A fixed "now" for the period math: 13 October 2026, afternoon in the city. */
const NOW = DateTime.fromISO('2026-10-13T15:00:00', { zone: ZONE })
const FORBIDDEN_MESSAGE =
  'O desempenho fica disponível para proprietários, administradores e analistas da organização.'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })
const local = (iso: string) => DateTime.fromISO(iso, { zone: ZONE })

let sequence = 0

function parsePage(response: { text(): string }): EstablishmentPerformancePageProps {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('The response does not contain an Inertia page payload')
  const page = JSON.parse(match[1]) as { component: string; props: unknown }
  if (page.component !== 'portal/establishments/performance') {
    throw new Error(`Unexpected component: ${page.component}`)
  }
  return page.props as EstablishmentPerformancePageProps
}

async function performance(
  establishment: Establishment,
  actor: User,
  period?: 'current_month' | 'previous_month' | 'last_90_days' | 'current_edition',
  now = NOW
) {
  const service = await app.container.make(EstablishmentPerformanceService)
  return service.page(establishment.tenant_id, establishment.id, actor, { period }, now)
}

async function estimateOf(establishment: Establishment, actor: User) {
  const page = await performance(establishment, actor)
  return page.estimate
}

async function metric(
  establishment: Establishment,
  scenario: EstablishmentScenario,
  date: string,
  eventType: string,
  count: number
) {
  const at = DateTime.fromISO(`${date}T12:00:00Z`)
  await db.table('analytics_daily_metrics').insert({
    tenant_id: establishment.tenant_id,
    metric_date: date,
    event_type: eventType,
    establishment_id: establishment.id,
    city_id: scenario.city.id,
    source: 'web',
    event_count: count,
    unique_sessions: count,
    first_event_at: at.toJSDate(),
    last_event_at: at.toJSDate(),
    expires_at: at.plus({ months: 25 }).toJSDate(),
  })
}

async function member(scenario: EstablishmentScenario, prefix: string) {
  sequence += 1
  return createUser({ prefix: `${prefix}-${sequence}`, tenant: scenario.tenant })
}

async function follow(
  table: 'explorer_follows' | 'explorer_favorites',
  scenario: EstablishmentScenario,
  establishment: Establishment,
  at: DateTime
) {
  const user = await member(scenario, table === 'explorer_follows' ? 'follower' : 'saver')
  await db.table(table).insert({
    tenant_id: establishment.tenant_id,
    user_id: user.id,
    establishment_id: establishment.id,
    created_at: at.toJSDate(),
    updated_at: at.toJSDate(),
  })
}

async function review(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  rating: number,
  at: DateTime,
  options: { status?: 'published' | 'hidden'; banned?: boolean } = {}
) {
  const author = await member(scenario, 'reviewer')
  await db.table('establishment_reviews').insert({
    tenant_id: establishment.tenant_id,
    establishment_id: establishment.id,
    user_id: author.id,
    rating,
    comment: 'Atendimento atencioso e comida boa.',
    status: options.status ?? 'published',
    created_at: at.toJSDate(),
    updated_at: at.toJSDate(),
  })
  if (options.banned) {
    await db
      .from('user_tenants')
      .where('tenant_id', establishment.tenant_id)
      .where('user_id', author.id)
      .update({ banned_at: at.toJSDate(), banned_by: scenario.owner.id })
  }
}

/** Confirmed uses of a benefit at the place, one per instant, by a single holder. */
async function redemptions(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  instants: DateTime[]
) {
  sequence += 1
  const holder = await member(scenario, 'holder')
  // Archived: the uses are history, and the edition must not become "current".
  const edition = await BenefitEdition.create({
    tenant_id: establishment.tenant_id,
    city_id: scenario.city.id,
    name: `Edição passada ${sequence}`,
    slug: `edicao-passada-${sequence}-${Date.now()}`,
    price_cents: 9900,
    currency: 'BRL',
    sales_starts_at: null,
    sales_ends_at: null,
    usage_starts_at: DateTime.utc(2026, 1, 1),
    usage_ends_at: DateTime.utc(2026, 12, 31),
    status: 'archived',
    created_by: scenario.owner.id,
    published_at: DateTime.utc(2026, 1, 1),
    archived_at: DateTime.utc(2026, 12, 31),
  })
  const offer = await BenefitOffer.create({
    tenant_id: establishment.tenant_id,
    edition_id: edition.id,
    establishment_id: establishment.id,
    title: 'Sobremesa cortesia',
    description: 'Uma sobremesa por mesa.',
    benefit_type: 'complimentary_item',
    available_weekdays_mask: 127,
    max_redemptions_per_access: 99,
    status: 'archived',
    created_by: scenario.owner.id,
    activated_at: DateTime.utc(2026, 1, 1),
    archived_at: DateTime.utc(2026, 12, 31),
  })
  const access = await BenefitAccess.create({
    tenant_id: establishment.tenant_id,
    edition_id: edition.id,
    user_id: holder.id,
    source: 'courtesy',
    status: 'active',
    granted_by: scenario.owner.id,
    granted_at: DateTime.utc(2026, 1, 1),
  })

  for (const [index, at] of instants.entries()) {
    await db.table('benefit_redemptions').insert({
      tenant_id: establishment.tenant_id,
      access_id: access.id,
      edition_id: edition.id,
      offer_id: offer.id,
      establishment_id: establishment.id,
      organization_id: establishment.organization_id,
      user_id: holder.id,
      redeemed_by: scenario.owner.id,
      redemption_number: index + 1,
      presentation_nonce_hash: randomBytes(32).toString('hex'),
      receipt_code: `EXP-${randomBytes(8).toString('hex').toUpperCase()}`,
      edition_name_snapshot: edition.name,
      offer_title_snapshot: offer.title,
      benefit_type_snapshot: 'complimentary_item',
      establishment_name_snapshot: 'Café do teste',
      holder_name_snapshot: holder.full_name,
      holder_email_snapshot: holder.email,
      redeemed_at: at.toJSDate(),
    })
  }
}

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
    applies_to_descendants: true,
    sort_order: 5,
    is_active: true,
    validation_rules: { minimum: 0, maximum: 500 },
  })
}

async function ticketValue(
  definition: CategoryAttributeDefinition,
  revisionId: number,
  value: number
) {
  await db.table('establishment_revision_attribute_values').insert({
    tenant_id: definition.tenant_id,
    revision_id: revisionId,
    attribute_definition_id: definition.id,
    value_decimal: value,
  })
}

async function roleScenario(prefix: string) {
  const scenario = await createEstablishmentScenario(prefix)
  const establishment = await createPublishedEstablishment(scenario, `Desempenho ${prefix}`)
  const users: Record<'admin' | 'editor' | 'analyst', User> = {
    admin: await member(scenario, `${prefix}-admin`),
    editor: await member(scenario, `${prefix}-editor`),
    analyst: await member(scenario, `${prefix}-analyst`),
  }
  for (const role of ['admin', 'editor', 'analyst'] as const) {
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: users[role],
      role,
    })
  }
  return { scenario, establishment, users }
}

test.group('Establishment performance', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('opens the place numbers to owners, admins, analysts and platform admins only', async ({
    client,
    assert,
  }) => {
    const { scenario, establishment, users } = await roleScenario('perf-roles')
    const path = `/portal/establishments/${establishment.id}/performance`
    const get = (user: User) =>
      client.get(path).headers(tenantHeader(scenario.tenant.id)).redirects(0).loginAs(user)
    const expectStatus = async (user: User, status: number) => {
      const response = await get(user)
      response.assertStatus(status)
    }

    for (const reader of [scenario.owner, users.admin, users.analyst]) {
      const response = await get(reader)
      response.assertStatus(200)
      assert.equal(response.header('cache-control'), 'private, no-store')
      assert.equal(response.header('x-robots-tag'), 'noindex, nofollow')
      assert.equal(parsePage(response).establishment.id, establishment.id)
    }

    const platformAdmin = await createUser({
      prefix: 'perf-roles-platform',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.ADMIN,
    })
    await expectStatus(platformAdmin, 200)

    // An editor has no analytics (ADR-0017): back to the place, with the reason.
    const editor = await get(users.editor)
    editor.assertStatus(302)
    assert.equal(editor.header('location'), `/portal/establishments/${establishment.id}`)
    editor.assertFlashMessage('warning', FORBIDDEN_MESSAGE)

    // A platform moderator reads organizations but not their analytics.
    const moderator = await createUser({
      prefix: 'perf-roles-moderator',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })
    const moderated = await get(moderator)
    moderated.assertStatus(302)
    moderated.assertFlashMessage('warning', FORBIDDEN_MESSAGE)

    // Outside the organization, the place does not exist.
    const outsider = await member(scenario, 'perf-roles-outsider')
    await expectStatus(outsider, 404)

    const otherOwner = await member(scenario, 'perf-roles-other-owner')
    await createOrganization({
      tenant: scenario.tenant,
      owner: otherOwner,
      status: 'active',
      prefix: 'Outra',
    })
    await expectStatus(otherOwner, 404)

    // A removed member is an outsider again.
    await db
      .from('organization_members')
      .where('organization_id', scenario.organization.id)
      .where('user_id', users.analyst.id)
      .update({ status: 'removed', removed_at: new Date() })
    await expectStatus(users.analyst, 404)

    const missing = await client
      .get(`/portal/establishments/${establishment.id + 100000}/performance`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    missing.assertStatus(404)
  })

  test('counts each number in the period and in the one it is compared with', async ({
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('perf-math')
    const establishment = await createPublishedEstablishment(scenario, 'Café dos Números')

    // Current: 1–13 October. Compared with: 1–13 September.
    await metric(establishment, scenario, '2026-10-02', 'catalog_impression', 5)
    await metric(establishment, scenario, '2026-10-13', 'catalog_impression', 3)
    await metric(establishment, scenario, '2026-09-02', 'catalog_impression', 4)
    await metric(establishment, scenario, '2026-09-20', 'catalog_impression', 100)
    await metric(establishment, scenario, '2026-08-31', 'catalog_impression', 50)
    await metric(establishment, scenario, '2026-10-05', 'establishment_view', 2)
    await metric(establishment, scenario, '2026-09-05', 'establishment_view', 1)
    await metric(establishment, scenario, '2026-10-06', 'route_click', 1)
    await metric(establishment, scenario, '2026-10-06', 'whatsapp_click', 2)
    await metric(establishment, scenario, '2026-09-06', 'phone_click', 1)
    await metric(establishment, scenario, '2026-10-07', 'website_click', 1)

    await follow('explorer_follows', scenario, establishment, local('2026-10-03T10:00'))
    await follow('explorer_follows', scenario, establishment, local('2026-10-03T11:00'))
    await follow('explorer_follows', scenario, establishment, local('2026-09-03T10:00'))
    await follow('explorer_follows', scenario, establishment, local('2026-09-20T10:00'))
    await follow('explorer_favorites', scenario, establishment, local('2026-10-04T10:00'))

    await redemptions(scenario, establishment, [
      // Days are the city's: 23:30 on 30 September there is already 1 October in
      // UTC, and it belongs to neither window.
      local('2026-10-01T00:30'),
      local('2026-09-30T23:30'),
      local('2026-10-12T20:00'),
      local('2026-09-10T20:00'),
    ])

    await review(scenario, establishment, 5, local('2026-10-08T12:00'))
    await review(scenario, establishment, 4, local('2026-10-09T12:00'))
    await review(scenario, establishment, 3, local('2026-09-08T12:00'))
    await review(scenario, establishment, 1, local('2026-10-10T12:00'), { status: 'hidden' })
    await review(scenario, establishment, 1, local('2026-10-11T12:00'), { banned: true })

    const definition = await ticketField(scenario)
    await ticketValue(definition, establishment.published_revision_id!, 42.5)

    const month = await performance(establishment, scenario.owner)

    assert.deepEqual(month.period, {
      key: 'current_month',
      from: '2026-10-01',
      to: '2026-10-13',
      previous_from: '2026-09-01',
      previous_to: '2026-09-13',
      days: 13,
      previous_days: 13,
    })
    assert.deepEqual(month.metrics.impressions, { current: 8, previous: 4 })
    assert.deepEqual(month.metrics.views, { current: 2, previous: 1 })
    assert.deepEqual(
      month.metrics.clicks.map(({ channel, current, previous }) => ({
        channel,
        current,
        previous,
      })),
      [
        { channel: 'route', current: 1, previous: 0 },
        { channel: 'whatsapp', current: 2, previous: 0 },
        { channel: 'phone', current: 0, previous: 1 },
        { channel: 'website', current: 1, previous: 0 },
      ]
    )
    assert.deepEqual(month.metrics.new_followers, { current: 2, previous: 1 })
    assert.deepEqual(month.metrics.new_favorites, { current: 1, previous: 0 })
    assert.deepEqual(month.metrics.redemptions, { current: 2, previous: 1 })
    assert.deepEqual(month.metrics.reviews, {
      count: { current: 2, previous: 1 },
      average: { current: 4.5, previous: 3 },
    })
    assert.deepEqual(month.estimate, {
      status: 'available',
      average_ticket_cents: 4250,
      current_cents: 8500,
      previous_cents: 4250,
    })

    // Only aggregates: no follower, author, holder, comment or receipt.
    assert.notMatch(
      JSON.stringify(month),
      /@example\.com|EXP-|(follower|saver|reviewer|holder)-\d|Atendimento/
    )

    assert.lengthOf(month.trend, 13)
    assert.deepEqual(month.trend[0], { date: '2026-10-01', impressions: 0, views: 0, clicks: 0 })
    assert.deepEqual(month.trend[1], { date: '2026-10-02', impressions: 5, views: 0, clicks: 0 })
    assert.deepEqual(month.trend[5], { date: '2026-10-06', impressions: 0, views: 0, clicks: 3 })
    assert.equal(month.trend.at(-1)!.date, '2026-10-13')

    // September against August, whole months.
    const previousMonth = await performance(establishment, scenario.owner, 'previous_month')
    assert.equal(previousMonth.period.from, '2026-09-01')
    assert.equal(previousMonth.period.to, '2026-09-30')
    assert.equal(previousMonth.period.previous_from, '2026-08-01')
    assert.deepEqual(previousMonth.metrics.impressions, { current: 104, previous: 50 })
    assert.deepEqual(previousMonth.metrics.redemptions, { current: 2, previous: 0 })
    assert.deepEqual(previousMonth.metrics.new_followers, { current: 2, previous: 0 })
    assert.lengthOf(previousMonth.trend, 30)

    // The last 90 days hold everything above; the 90 before hold nothing.
    const quarter = await performance(establishment, scenario.owner, 'last_90_days')
    assert.equal(quarter.period.days, 90)
    assert.deepEqual(quarter.metrics.impressions, { current: 162, previous: 0 })
    assert.deepEqual(quarter.metrics.redemptions, { current: 4, previous: 0 })
    assert.deepEqual(quarter.estimate, {
      status: 'available',
      average_ticket_cents: 4250,
      current_cents: 17000,
      previous_cents: 0,
    })
  })

  test('offers the edition period only while an edition with the place runs', async ({
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('perf-edition')
    const establishment = await createPublishedEstablishment(scenario, 'Bistrô da Edição')

    const before = await performance(establishment, scenario.owner, 'current_edition')
    assert.equal(before.period.key, 'current_month')
    assert.deepEqual(before.periods, ['current_month', 'previous_month', 'last_90_days'])
    assert.isNull(before.edition)

    const edition = await BenefitEdition.create({
      tenant_id: scenario.tenant.id,
      city_id: scenario.city.id,
      name: 'Experimente+ Primavera',
      slug: `primavera-${Date.now()}`,
      price_cents: 14990,
      currency: 'BRL',
      sales_starts_at: null,
      sales_ends_at: null,
      usage_starts_at: local('2026-10-04T00:00'),
      usage_ends_at: local('2026-12-31T23:59'),
      status: 'published',
      created_by: scenario.owner.id,
      published_at: local('2026-10-01T00:00'),
      archived_at: null,
    })
    const offer = await BenefitOffer.create({
      tenant_id: scenario.tenant.id,
      edition_id: edition.id,
      establishment_id: establishment.id,
      title: 'Café cortesia',
      description: 'Um café por pessoa.',
      benefit_type: 'complimentary_item',
      available_weekdays_mask: 127,
      max_redemptions_per_access: 1,
      status: 'draft',
      created_by: scenario.owner.id,
      activated_at: null,
      archived_at: null,
    })

    // A draft offer does not put the place in the edition yet.
    const draftOnly = await performance(establishment, scenario.owner)
    assert.isNull(draftOnly.edition)

    offer.status = 'active'
    offer.activated_at = local('2026-10-04T00:00')
    await offer.save()

    const running = await performance(establishment, scenario.owner, 'current_edition')
    assert.deepEqual(running.periods, [
      'current_month',
      'previous_month',
      'last_90_days',
      'current_edition',
    ])
    assert.deepEqual(running.edition, {
      name: 'Experimente+ Primavera',
      starts_on: '2026-10-04',
      ends_on: '2026-12-31',
    })
    assert.include(running.period, {
      key: 'current_edition',
      from: '2026-10-04',
      to: '2026-10-13',
      previous_from: '2026-09-24',
      previous_to: '2026-10-03',
      days: 10,
      previous_days: 10,
    })

    // After the edition ends there is no current edition to show.
    const later = await performance(
      establishment,
      scenario.owner,
      'current_edition',
      local('2027-01-10T12:00')
    )
    assert.equal(later.period.key, 'current_month')
    assert.isNull(later.edition)
  })

  test('estimates sales only from a published ticket and otherwise asks for it', async ({
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('perf-ticket')
    const establishment = await createPublishedEstablishment(scenario, 'Cantina do Ticket')
    await redemptions(scenario, establishment, [local('2026-10-05T19:00')])

    // The category has no "Ticket médio" field: nothing to fill, no figure.
    assert.deepEqual(await estimateOf(establishment, scenario.owner), {
      status: 'missing',
      field_available: false,
    })

    // The field exists but the place left it empty: the page asks for it.
    const definition = await ticketField(scenario)
    assert.deepEqual(await estimateOf(establishment, scenario.owner), {
      status: 'missing',
      field_available: true,
    })

    // Filled in a new version that waits for approval: not used yet.
    const draft = await EstablishmentRevision.create({
      establishment_id: establishment.id,
      tenant_id: scenario.tenant.id,
      version: 2,
      status: 'pending_review',
      public_name: 'Cantina do Ticket',
      slug: `cantina-do-ticket-v2-${Date.now()}`,
      city_id: scenario.city.id,
      short_description: 'Massas frescas e vinhos da casa.',
      created_by: scenario.owner.id,
      submitted_at: DateTime.utc(),
    })
    await ticketValue(definition, draft.id, 60)
    assert.deepEqual(await estimateOf(establishment, scenario.owner), {
      status: 'pending_review',
    })

    // Once published, uses × ticket, in cents.
    await ticketValue(definition, establishment.published_revision_id!, 37.9)
    assert.deepEqual(await estimateOf(establishment, scenario.owner), {
      status: 'available',
      average_ticket_cents: 3790,
      current_cents: 3790,
      previous_cents: 0,
    })

    // A disabled field is no longer the place's ticket.
    definition.is_active = false
    await definition.save()
    const disabled = await estimateOf(establishment, scenario.owner)
    assert.equal(disabled.status, 'missing')
  })

  test('shows zeros for a place without movement and says when it is not published', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('perf-zero')
    const establishment = await createPublishedEstablishment(scenario, 'Casa Silenciosa')

    const response = await client
      .get(`/portal/establishments/${establishment.id}/performance?period=nao-existe`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    response.assertStatus(200)
    const page = parsePage(response)

    assert.equal(page.period.key, 'current_month')
    assert.isTrue(page.establishment.published)
    assert.equal(page.establishment.name, 'Casa Silenciosa')
    for (const key of [
      'impressions',
      'views',
      'new_followers',
      'new_favorites',
      'redemptions',
    ] as const) {
      assert.deepEqual(page.metrics[key], { current: 0, previous: 0 }, key)
    }
    assert.deepEqual(page.metrics.reviews, {
      count: { current: 0, previous: 0 },
      average: { current: null, previous: null },
    })
    assert.isTrue(page.metrics.clicks.every((click) => click.current === 0 && click.previous === 0))
    assert.lengthOf(page.trend, page.period.days)
    assert.isTrue(page.trend.every((day) => day.impressions + day.views + day.clicks === 0))
    assert.deepEqual(page.estimate, { status: 'missing', field_available: false })

    const draft = await EstablishmentRevision.create({
      establishment_id: establishment.id,
      tenant_id: scenario.tenant.id,
      version: 2,
      status: 'draft',
      public_name: 'Casa Silenciosa Nova',
      slug: null,
      city_id: scenario.city.id,
      short_description: null,
      created_by: scenario.owner.id,
    })
    assert.isNotNull(draft.id)
    await db
      .from('establishments')
      .where('id', establishment.id)
      .update({ published_revision_id: null })

    const unpublished = await performance(establishment, scenario.owner)
    assert.isFalse(unpublished.establishment.published)
    assert.equal(unpublished.establishment.name, 'Casa Silenciosa Nova')
  })

  test('keeps other places and other operations out of the numbers', async ({ client, assert }) => {
    const first = await createEstablishmentScenario('perf-tenant-a')
    const place = await createPublishedEstablishment(first, 'Lugar da Operação A')
    const sibling = await createPublishedEstablishment(first, 'Vizinho da Operação A')
    const second = await createEstablishmentScenario('perf-tenant-b')
    const foreign = await createPublishedEstablishment(second, 'Lugar da Operação B')

    for (const [establishment, scenario, count] of [
      [place, first, 3],
      [sibling, first, 40],
      [foreign, second, 500],
    ] as const) {
      await metric(establishment, scenario, '2026-10-02', 'catalog_impression', count)
      await redemptions(scenario, establishment, [local('2026-10-03T12:00')])
    }

    const own = await performance(place, first.owner)
    assert.deepEqual(own.metrics.impressions, { current: 3, previous: 0 })
    assert.deepEqual(own.metrics.redemptions, { current: 1, previous: 0 })

    // The other operation's place, asked for under the partner's own operation.
    const crossTenant = await client
      .get(`/portal/establishments/${foreign.id}/performance`)
      .headers(tenantHeader(first.tenant.id))
      .loginAs(first.owner)
    crossTenant.assertStatus(404)

    // And the partner's place asked for under an operation they do not belong to.
    const foreignOperation = await client
      .get(`/portal/establishments/${place.id}/performance`)
      .headers(tenantHeader(second.tenant.id))
      .loginAs(first.owner)
    assert.notEqual(foreignOperation.status(), 200)

    // The other operation's owner cannot read this place either.
    const service = await app.container.make(EstablishmentPerformanceService)
    await assert.rejects(() => service.page(first.tenant.id, place.id, second.owner, {}, NOW))
  })
})
