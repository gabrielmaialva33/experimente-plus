import { randomBytes, randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { mock } from 'node:test'

import ace from '@adonisjs/core/services/ace'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime, Settings } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import {
  ANALYTICS_SESSION_COOKIE,
  type IAnalytics,
} from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsDailyMetric from '#modules/analytics/models/analytics_daily_metric'
import AnalyticsDailySearchTerm from '#modules/analytics/models/analytics_daily_search_term'
import AnalyticsEvent from '#modules/analytics/models/analytics_event'
import AnalyticsEventService from '#modules/analytics/services/analytics_event_service'
import AnalyticsRetentionService from '#modules/analytics/services/analytics_retention_service'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { addOrganizationMember, createUser } from '#tests/functional/organizations/helpers'
import DiscardAnalyticsSessions from '../../../commands/discard_analytics_sessions.js'

const GPTBOT =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'

const fixture = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'media', name)
const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })
const publicHeaders = (scenario: EstablishmentScenario) => ({
  'host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-for': `198.51.100.${(scenario.tenant.id % 240) + 10}`,
})

interface PublishedEstablishment {
  id: number
  city_slug: string
  establishment_slug: string
  public_name: string
  media_id: number
  revision_id: number
}

async function createModerator(scenario: EstablishmentScenario) {
  return createUser({
    prefix: 'analytics-moderator',
    tenant: scenario.tenant,
    tenantRole: 'member',
    globalRole: IRoles.Slugs.MODERATOR,
  })
}

async function createDraft(
  client: ApiClient,
  scenario: EstablishmentScenario,
  publicName: string
): Promise<number> {
  const response = await client
    .post(`/api/v1/organizations/${scenario.organization.id}/establishments`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .json({
      public_name: publicName,
      city_id: scenario.city.id,
      short_description: 'Ficha publicada para validar analytics de descoberta',
      public_phone: '(43) 99999-1234',
      whatsapp: '(43) 99999-1234',
      website: 'https://example.com/experimente',
      availability_type: 'regular_hours',
    })

  response.assertStatus(201)
  return Number(response.body().id)
}

async function completeAndPublish(
  client: ApiClient,
  scenario: EstablishmentScenario,
  publicName = 'Café Analytics Regional'
): Promise<PublishedEstablishment> {
  const establishmentId = await createDraft(client, scenario, publicName)

  const requests = [
    client
      .put(`/api/v1/establishments/${establishmentId}/address`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        postal_code: '86300000',
        street: 'Rua das Flores',
        number: '120',
        without_number: false,
        district: 'Centro',
        latitude: -23.18,
        longitude: -50.65,
        coordinate_source: 'manual',
      }),
    client
      .put(`/api/v1/establishments/${establishmentId}/categories`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        categories: [{ category_id: scenario.primaryCategory.id, is_primary: true }],
      }),
    client
      .put(`/api/v1/establishments/${establishmentId}/attributes`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        attributes: [
          { attribute_definition_id: scenario.inheritedBoolean.id, value: true },
          {
            attribute_definition_id: scenario.selectDefinition.id,
            option_ids: [scenario.standardOption.id],
          },
        ],
      }),
    client
      .put(`/api/v1/establishments/${establishmentId}/hours`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ hours: [{ weekday: 1, opens_at: '08:00', closes_at: '18:00' }] }),
  ]

  for (const request of requests) {
    const response = await request
    response.assertStatus(200)
  }

  const media = await client
    .post(`/api/v1/establishments/${establishmentId}/media`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .field('alt_text', `Fachada de ${publicName}`)
    .field('is_cover', 'true')
    .file('file', fixture('valid.png'))
  media.assertStatus(201)
  const mediaId = Number(media.body().id)

  const submitted = await client
    .post(`/api/v1/establishments/${establishmentId}/submit`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
  submitted.assertStatus(200)

  const moderator = await createModerator(scenario)
  const approvedMedia = await client
    .post(`/api/v1/admin/media/${mediaId}/approve`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(moderator)
    .json({})
  approvedMedia.assertStatus(200)

  const revision = await EstablishmentRevision.query()
    .where('establishment_id', establishmentId)
    .where('status', 'pending_review')
    .firstOrFail()

  const approvedRevision = await client
    .post(`/api/v1/admin/establishment-revisions/${revision.id}/approve`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(moderator)
    .json({ reason: 'Ficha aprovada para o catálogo público' })
  approvedRevision.assertStatus(200)

  return {
    id: establishmentId,
    city_slug: scenario.city.slug,
    establishment_slug: revision.slug!,
    public_name: publicName,
    media_id: mediaId,
    revision_id: revision.id,
  }
}

function analyticsEvent(
  eventType: string,
  published: PublishedEstablishment,
  overrides: Record<string, unknown> = {}
) {
  return {
    event_id: randomUUID(),
    event_type: eventType,
    city_slug: published.city_slug,
    establishment_slug: published.establishment_slug,
    ...overrides,
  }
}

test.group('Discovery analytics', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(async () => {
    await rm(app.makePath('storage', 'media'), { recursive: true, force: true })
  })

  test('records privacy-safe events and keeps raw and daily aggregates idempotent', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('analytics-ingest')
    const published = await completeAndPublish(client, scenario)
    const events = [
      analyticsEvent('catalog_impression', published, { search_term: 'Estação' }),
      analyticsEvent('establishment_view', published),
      {
        event_id: randomUUID(),
        event_type: 'search_without_results',
        city_slug: published.city_slug,
        category_slug: scenario.primaryCategory.slug,
        search_term: 'Café gabriel@example.com 43 99999-1234',
      },
    ]

    const response = await client
      .post('/api/v1/analytics/events')
      .headers(publicHeaders(scenario))
      .json({ events })

    response.assertStatus(202)
    assert.equal(response.body().accepted, 3)
    assert.equal(response.body().recorded, 3)
    assert.equal(response.body().deduplicated, 0)
    assert.equal(response.body().suppressed, 0)
    assert.isDefined(response.headers()['set-cookie'])

    const repeated = await client
      .post('/api/v1/analytics/events')
      .headers(publicHeaders(scenario))
      .json({ events })
    repeated.assertStatus(202)
    assert.equal(repeated.body().accepted, 3)
    assert.equal(repeated.body().recorded, 0)
    assert.equal(repeated.body().deduplicated, 3)
    assert.equal(repeated.body().suppressed, 0)

    const rawEvents = await AnalyticsEvent.query()
      .where('tenant_id', scenario.tenant.id)
      .orderBy('id', 'asc')
    assert.lengthOf(rawEvents, 3)
    assert.isTrue(rawEvents.every((event) => event.anonymous_session_hash.length === 64))
    assert.isTrue(rawEvents.every((event) => event.dedupe_key.length === 64))

    const impressionEvent = rawEvents.find((event) => event.event_type === 'catalog_impression')
    assert.exists(impressionEvent)
    assert.isNull(impressionEvent!.search_term_redacted)
    assert.isNull(impressionEvent!.search_term_hash)

    const searchEvent = rawEvents.find((event) => event.event_type === 'search_without_results')
    assert.exists(searchEvent)
    assert.notInclude(searchEvent!.search_term_redacted!, 'gabriel@example.com')
    assert.notInclude(searchEvent!.search_term_redacted!, '99999-1234')
    assert.include(searchEvent!.search_term_redacted!, '[email]')
    assert.include(searchEvent!.search_term_redacted!, '[telefone]')
    assert.lengthOf(searchEvent!.search_term_hash!, 64)

    const metrics = await AnalyticsDailyMetric.query().where('tenant_id', scenario.tenant.id)
    assert.lengthOf(metrics, 2)
    assert.isTrue(metrics.every((metric) => metric.event_count === 1))
    assert.isTrue(metrics.every((metric) => metric.unique_sessions === 1))

    const terms = await AnalyticsDailySearchTerm.query().where('tenant_id', scenario.tenant.id)
    assert.lengthOf(terms, 1)
    assert.equal(terms[0].event_count, 1)
    assert.equal(terms[0].unique_sessions, 1)
  })

  test('honors Do Not Track and Global Privacy Control without creating a visitor cookie', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('analytics-privacy-signals')
    const response = await client
      .post('/api/v1/analytics/events')
      .headers({ ...publicHeaders(scenario), 'dnt': '1', 'sec-gpc': '1' })
      .json({
        events: [
          {
            event_id: randomUUID(),
            event_type: 'establishment_view',
            city_slug: 'cidade-privada',
            establishment_slug: 'unidade-privada',
          },
        ],
      })

    response.assertStatus(202)
    response.assertBodyContains({
      accepted: 1,
      recorded: 0,
      deduplicated: 0,
      suppressed: 1,
    })
    const setCookieHeader = response.headers()['set-cookie'] as string | string[] | undefined
    const setCookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : []
    assert.isFalse(setCookies.some((cookie) => cookie.startsWith(`${ANALYTICS_SESSION_COOKIE}=`)))
    assert.equal(
      await AnalyticsEvent.query()
        .where('tenant_id', scenario.tenant.id)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      0
    )
  })

  test('rejects malformed and cross-operation event targets without leaking catalog data', async ({
    client,
    assert,
  }) => {
    const first = await createEstablishmentScenario('analytics-scope-first')
    const second = await createEstablishmentScenario('analytics-scope-second')
    const published = await completeAndPublish(client, first, 'Unidade Analytics Isolada')

    const crossOperation = await client
      .post('/api/v1/analytics/events')
      .headers(publicHeaders(second))
      .json({ events: [analyticsEvent('establishment_view', published)] })
    crossOperation.assertStatus(404)

    const malformed = await client
      .post('/api/v1/analytics/events')
      .headers(publicHeaders(first))
      .json({
        events: [
          analyticsEvent('search_without_results', published, {
            search_term: 'consulta inválida',
          }),
        ],
      })
    malformed.assertStatus(400)

    assert.equal(
      await AnalyticsEvent.query()
        .where('tenant_id', second.tenant.id)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      0
    )
  })

  test('scopes organization dashboards and platform no-result reports by capability', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('analytics-dashboard')
    const published = await completeAndPublish(client, scenario, 'Painel Analytics Regional')

    const ingestion = await client
      .post('/api/v1/analytics/events')
      .headers(publicHeaders(scenario))
      .json({
        events: [
          analyticsEvent('catalog_impression', published),
          analyticsEvent('establishment_view', published),
          analyticsEvent('route_click', published),
          {
            event_id: randomUUID(),
            event_type: 'search_without_results',
            city_slug: published.city_slug,
            search_term: 'serviço inexistente perto de mim',
          },
        ],
      })
    ingestion.assertStatus(202)

    const ownerDashboard = await client
      .get(`/api/v1/organizations/${scenario.organization.id}/analytics`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    ownerDashboard.assertStatus(200)
    ownerDashboard.assertBodyContains({
      organization_id: scenario.organization.id,
      establishments: [{ establishment_id: published.id, conversions: 1 }],
    })
    assert.include(
      ownerDashboard.body().totals.map((metric: { event_type: string }) => metric.event_type),
      'establishment_view'
    )

    const analyticsPage = await client
      .get(`/organizations/${scenario.organization.id}/analytics`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    analyticsPage.assertStatus(200)
    assert.include(analyticsPage.text(), 'analytics/organization')
    assert.equal(analyticsPage.header('cache-control'), 'private, no-store')
    assert.equal(analyticsPage.header('x-robots-tag'), 'noindex, nofollow')

    const analyst = await createUser({
      prefix: 'analytics-analyst',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: analyst,
      role: 'analyst',
    })
    const analystDashboard = await client
      .get(`/api/v1/organizations/${scenario.organization.id}/analytics`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(analyst)
    analystDashboard.assertStatus(200)

    const editor = await createUser({
      prefix: 'analytics-editor',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: editor,
      role: 'editor',
    })
    const editorDashboard = await client
      .get(`/api/v1/organizations/${scenario.organization.id}/analytics`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(editor)
    editorDashboard.assertStatus(403)

    const outsider = await createUser({
      prefix: 'analytics-outsider',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    const outsiderDashboard = await client
      .get(`/api/v1/organizations/${scenario.organization.id}/analytics`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(outsider)
    outsiderDashboard.assertStatus(404)

    const administrator = await createUser({
      prefix: 'analytics-admin',
      tenant: scenario.tenant,
      tenantRole: 'member',
      globalRole: IRoles.Slugs.ADMIN,
    })
    const administratorDashboard = await client
      .get(`/api/v1/organizations/${scenario.organization.id}/analytics`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(administrator)
    administratorDashboard.assertStatus(200)

    const noResults = await client
      .get('/api/v1/admin/analytics/searches/no-results')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(administrator)
    noResults.assertStatus(200)
    noResults.assertBodyContains({
      data: [{ term: 'serviço inexistente perto de mim', searches: 1 }],
    })

    const partnerAdminAttempt = await client
      .get('/api/v1/admin/analytics/searches/no-results')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    partnerAdminAttempt.assertStatus(403)
  })

  test('records only allowlisted outbound destinations and never acts as an open redirect', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('analytics-redirect')
    const published = await completeAndPublish(client, scenario, 'Rotas Analytics Seguras')

    const route = await client
      .get(`/go/${published.city_slug}/${published.establishment_slug}/route`)
      .headers(publicHeaders(scenario))
      .redirects(0)
    route.assertStatus(302)
    assert.match(route.header('location')!, /^https:\/\/www\.google\.com\/maps\/dir\//)

    const phone = await client
      .get(`/go/${published.city_slug}/${published.establishment_slug}/phone`)
      .headers(publicHeaders(scenario))
      .redirects(0)
    phone.assertStatus(302)
    assert.match(phone.header('location')!, /^tel:\+55/)

    const website = await client
      .get(`/go/${published.city_slug}/${published.establishment_slug}/website`)
      .headers(publicHeaders(scenario))
      .redirects(0)
    website.assertStatus(302)
    assert.equal(website.header('location'), 'https://example.com/experimente')

    const privateRoute = await client
      .get(`/go/${published.city_slug}/${published.establishment_slug}/route`)
      .headers({ ...publicHeaders(scenario), dnt: '1' })
      .redirects(0)
    privateRoute.assertStatus(302)

    const invalid = await client
      .get(`/go/${published.city_slug}/${published.establishment_slug}/custom-url`)
      .headers(publicHeaders(scenario))
      .redirects(0)
    invalid.assertStatus(404)

    await db
      .from('catalog_establishments')
      .where('tenant_id', scenario.tenant.id)
      .where('establishment_id', published.id)
      .update({ website: 'javascript:alert(1)' })

    const unsafe = await client
      .get(`/go/${published.city_slug}/${published.establishment_slug}/website`)
      .headers(publicHeaders(scenario))
      .redirects(0)
    unsafe.assertStatus(404)

    const clicks = await AnalyticsEvent.query()
      .where('tenant_id', scenario.tenant.id)
      .whereIn('event_type', ['route_click', 'phone_click', 'website_click'])
    assert.lengthOf(clicks, 3)
  })

  test('redirects crawlers without recording them and answers their batches as recorded', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('analytics-crawlers')
    const published = await completeAndPublish(client, scenario, 'Robôs Analytics Regionais')
    const crawler = { ...publicHeaders(scenario), 'user-agent': GPTBOT }
    const person = { ...publicHeaders(scenario), 'user-agent': ANDROID_CHROME }
    const recorded = () =>
      AnalyticsEvent.query()
        .where('tenant_id', scenario.tenant.id)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total))

    for (const action of ['route', 'whatsapp', 'phone', 'website']) {
      const crawled = await client
        .get(`/go/${published.city_slug}/${published.establishment_slug}/${action}`)
        .headers(crawler)
        .redirects(0)
      crawled.assertStatus(302)
      assert.isNotEmpty(crawled.header('location'))
      assert.notInclude(String(crawled.header('set-cookie') ?? ''), ANALYTICS_SESSION_COOKIE)
    }
    assert.equal(await recorded(), 0)

    // The same batch from a crawler and from a person: same status, same
    // answer, but only the person's events reach the raw table and aggregates.
    const batch = () => [
      analyticsEvent('establishment_view', published),
      analyticsEvent('route_click', published),
    ]
    const crawledBatch = batch()
    const crawledIngestion = await client
      .post('/api/v1/analytics/events')
      .headers(crawler)
      .json({ events: crawledBatch })
    crawledIngestion.assertStatus(202)
    assert.notInclude(String(crawledIngestion.header('set-cookie') ?? ''), ANALYTICS_SESSION_COOKIE)
    assert.equal(await recorded(), 0)
    assert.equal(
      await AnalyticsDailyMetric.query()
        .where('tenant_id', scenario.tenant.id)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      0
    )

    const personBatch = batch()
    const personIngestion = await client
      .post('/api/v1/analytics/events')
      .headers(person)
      .json({ events: personBatch })
    personIngestion.assertStatus(202)
    assert.equal(await recorded(), 2)

    const withoutIds = (body: { events: Array<{ event_id: string }> }) => ({
      ...body,
      events: body.events.map(({ event_id: _eventId, ...event }) => event),
    })
    assert.deepEqual(withoutIds(crawledIngestion.body()), withoutIds(personIngestion.body()))
    assert.deepEqual(
      crawledIngestion.body().events.map((event: { event_id: string }) => event.event_id),
      crawledBatch.map((event) => event.event_id)
    )

    // Targets are checked as for anyone: a crawler cannot tell its batches apart.
    const unknown = await client
      .post('/api/v1/analytics/events')
      .headers(crawler)
      .json({
        events: [
          analyticsEvent('establishment_view', { ...published, establishment_slug: 'nada' }),
        ],
      })
    unknown.assertStatus(404)

    const clicked = await client
      .get(`/go/${published.city_slug}/${published.establishment_slug}/route`)
      .headers(person)
      .redirects(0)
    clicked.assertStatus(302)
    assert.equal(await recorded(), 3)
  })

  test('keeps raw events append-only and prunes only expired analytics data', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('analytics-retention')
    const published = await completeAndPublish(client, scenario, 'Retenção Analytics Regional')
    const ingestion = await client
      .post('/api/v1/analytics/events')
      .headers(publicHeaders(scenario))
      .json({
        events: [
          analyticsEvent('establishment_view', published),
          {
            event_id: randomUUID(),
            event_type: 'search_without_results',
            city_slug: published.city_slug,
            search_term: 'consulta para retenção',
          },
        ],
      })
    ingestion.assertStatus(202)

    const event = await AnalyticsEvent.query()
      .where('tenant_id', scenario.tenant.id)
      .where('event_type', 'establishment_view')
      .firstOrFail()

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction
          .from('analytics_events')
          .where('id', event.id)
          .update({ source: 'server' })
      })
    )

    await assert.rejects(() =>
      db.transaction(async (transaction) => {
        await transaction.from('analytics_events').where('id', event.id).delete()
      })
    )

    const old = DateTime.utc().minus({ days: 120 })
    await db.table('analytics_events').insert({
      tenant_id: event.tenant_id,
      event_id: randomUUID(),
      event_type: event.event_type,
      establishment_id: event.establishment_id,
      published_revision_id: event.published_revision_id,
      city_id: event.city_id,
      metric_date: old.toISODate(),
      anonymous_session_hash: 'a'.repeat(64),
      dedupe_key: 'b'.repeat(64),
      source: 'server',
      occurred_at: old.toJSDate(),
      expires_at: old.plus({ days: 90 }).toJSDate(),
      created_at: old.toJSDate(),
    })

    const expiredAt = DateTime.utc().minus({ day: 1 }).toJSDate()
    await db
      .from('analytics_daily_metrics')
      .where('tenant_id', scenario.tenant.id)
      .update({
        first_event_at: old.toJSDate(),
        last_event_at: old.plus({ minutes: 1 }).toJSDate(),
        expires_at: expiredAt,
      })
    await db
      .from('analytics_daily_metric_sessions')
      .where('tenant_id', scenario.tenant.id)
      .update({ expires_at: expiredAt })
    await db
      .from('analytics_daily_search_terms')
      .where('tenant_id', scenario.tenant.id)
      .update({
        first_event_at: old.toJSDate(),
        last_event_at: old.plus({ minutes: 1 }).toJSDate(),
        expires_at: expiredAt,
      })
    await db
      .from('analytics_daily_search_sessions')
      .where('tenant_id', scenario.tenant.id)
      .update({ expires_at: expiredAt })

    const retention = await app.container.make(AnalyticsRetentionService)
    const result = await retention.prune()

    assert.equal(result.raw_events_deleted, 1)
    assert.isAtLeast(result.metrics_deleted, 1)
    assert.isAtLeast(result.metric_sessions_deleted, 1)
    assert.isAtLeast(result.search_terms_deleted, 1)
    assert.isAtLeast(result.search_sessions_deleted, 1)
    assert.isNotNull(await AnalyticsEvent.find(event.id))
  })
})

const sessionHash = () => randomBytes(32).toString('hex')

/** Records through the production write path, at a chosen instant. */
async function recordAt(
  tenantId: number,
  at: DateTime,
  anonymousSessionHash: string,
  events: IAnalytics.PublicEventInput[],
  source: IAnalytics.Source = 'web'
) {
  const now = Settings.now
  Settings.now = () => at.toMillis()
  try {
    const service = await app.container.make(AnalyticsEventService)
    const result = await service.recordBatchForTenant(
      tenantId,
      events,
      anonymousSessionHash,
      source
    )
    if (result.recorded !== events.length) {
      throw new Error(`Fixture deduplicated ${result.deduplicated} event(s)`)
    }
  } finally {
    Settings.now = now
  }
}

function establishmentEvent(
  eventType: IAnalytics.EstablishmentEventType,
  target: PublishedEstablishment
) {
  return analyticsEvent(eventType, target) as IAnalytics.PublicEventInput
}

function noResultSearch(target: PublishedEstablishment, term: string): IAnalytics.PublicEventInput {
  return {
    event_id: randomUUID(),
    event_type: 'search_without_results',
    city_slug: target.city_slug,
    search_term: term,
  }
}

/** Every analytics row of one operation, as stored. */
async function analyticsState(tenantId: number) {
  const rows = async (sql: string) => {
    const result = await db.rawQuery(sql, [tenantId])
    return result.rows
  }
  return {
    events: await rows(
      'SELECT id, anonymous_session_hash FROM analytics_events WHERE tenant_id = ? ORDER BY id'
    ),
    metrics: await rows(`
      SELECT id, metric_date::text AS metric_date, event_type, establishment_id, source,
        event_count::int AS event_count, unique_sessions::int AS unique_sessions,
        first_event_at, last_event_at, updated_at
      FROM analytics_daily_metrics WHERE tenant_id = ? ORDER BY id
    `),
    metricSessions: await rows(
      'SELECT id, anonymous_session_hash FROM analytics_daily_metric_sessions WHERE tenant_id = ? ORDER BY id'
    ),
    searchTerms: await rows(`
      SELECT id, metric_date::text AS metric_date, city_id, search_term_hash, category_key,
        event_count::int AS event_count, unique_sessions::int AS unique_sessions,
        first_event_at, last_event_at, updated_at
      FROM analytics_daily_search_terms WHERE tenant_id = ? ORDER BY id
    `),
    searchSessions: await rows(
      'SELECT id, anonymous_session_hash FROM analytics_daily_search_sessions WHERE tenant_id = ? ORDER BY id'
    ),
  }
}

/**
 * The daily aggregates must equal what the raw events produce from scratch:
 * counts, distinct sessions (also as session rows) and first/last instants,
 * with no aggregate row lacking raw events and no raw events lacking one.
 */
async function assertAggregatesMatchRecomputation(
  assert: { deepEqual: (actual: unknown, expected: unknown, message?: string) => void },
  tenantId: number
) {
  const rows = async (sql: string) => {
    const result = await db.rawQuery(sql, [tenantId])
    return result.rows
  }
  const metricKey = 'metric_date::text AS metric_date, event_type, establishment_id, source'
  const searchKey =
    "metric_date::text AS metric_date, city_id, search_term_hash, COALESCE(category_slug, '') AS category_key"

  const recomputedMetrics = await rows(`
    SELECT ${metricKey}, COUNT(*)::int AS event_count,
      COUNT(DISTINCT anonymous_session_hash)::int AS unique_sessions,
      MIN(occurred_at) AS first_event_at, MAX(occurred_at) AS last_event_at
    FROM analytics_events
    WHERE tenant_id = ? AND establishment_id IS NOT NULL
    GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4
  `)
  const storedMetrics = await rows(`
    SELECT ${metricKey}, event_count::int AS event_count, unique_sessions::int AS unique_sessions,
      first_event_at, last_event_at
    FROM analytics_daily_metrics WHERE tenant_id = ? ORDER BY 1, 2, 3, 4
  `)
  const metricSessionRows = await rows(`
    SELECT ${metricKey}, COUNT(*)::int AS unique_sessions
    FROM analytics_daily_metric_sessions WHERE tenant_id = ?
    GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4
  `)
  assert.deepEqual(storedMetrics, recomputedMetrics, 'daily metrics')
  assert.deepEqual(
    metricSessionRows,
    recomputedMetrics.map(
      ({ event_count: _events, first_event_at: _first, last_event_at: _last, ...row }: any) => row
    ),
    'daily metric sessions'
  )

  const recomputedTerms = await rows(`
    SELECT ${searchKey}, COUNT(*)::int AS event_count,
      COUNT(DISTINCT anonymous_session_hash)::int AS unique_sessions,
      MIN(occurred_at) AS first_event_at, MAX(occurred_at) AS last_event_at
    FROM analytics_events
    WHERE tenant_id = ? AND event_type = 'search_without_results'
    GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4
  `)
  const storedTerms = await rows(`
    SELECT metric_date::text AS metric_date, city_id, search_term_hash, category_key,
      event_count::int AS event_count, unique_sessions::int AS unique_sessions,
      first_event_at, last_event_at
    FROM analytics_daily_search_terms WHERE tenant_id = ? ORDER BY 1, 2, 3, 4
  `)
  const searchSessionRows = await rows(`
    SELECT metric_date::text AS metric_date, city_id, search_term_hash, category_key,
      COUNT(*)::int AS unique_sessions
    FROM analytics_daily_search_sessions WHERE tenant_id = ?
    GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4
  `)
  assert.deepEqual(storedTerms, recomputedTerms, 'daily search terms')
  assert.deepEqual(
    searchSessionRows,
    recomputedTerms.map(
      ({ event_count: _events, first_event_at: _first, last_event_at: _last, ...row }: any) => row
    ),
    'daily search sessions'
  )
}

const without = <Row extends { anonymous_session_hash: string }>(rows: Row[], hashes: string[]) =>
  rows.filter((row) => !hashes.includes(row.anonymous_session_hash))

test.group('Discarding anonymous analytics sessions', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(async () => {
    mock.restoreAll()
    await rm(app.makePath('storage', 'media'), { recursive: true, force: true })
  })

  test('removes named sessions in one transaction and leaves aggregates equal to a recomputation', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('analytics-discard')
    const first = await completeAndPublish(client, scenario, 'Café Descarte Regional')
    const second = await completeAndPublish(client, scenario, 'Bar Descarte Regional')
    const tenantId = scenario.tenant.id
    const [person, otherPerson, bystander, crawler, otherCrawler] = Array.from(
      { length: 5 },
      sessionHash
    )
    const day = DateTime.utc()
      .minus({ days: 3 })
      .set({ hour: 15, minute: 0, second: 0, millisecond: 0 })
    const at = (minutes: number, seconds = 0) => day.plus({ minutes, seconds })

    await recordAt(tenantId, at(0), person, [
      establishmentEvent('catalog_impression', first),
      establishmentEvent('establishment_view', first),
      establishmentEvent('route_click', first),
      noResultSearch(first, 'café vegano'),
    ])
    await recordAt(tenantId, at(1), otherPerson, [
      establishmentEvent('establishment_view', first),
      establishmentEvent('establishment_view', second),
    ])
    await recordAt(
      tenantId,
      at(1),
      otherPerson,
      [establishmentEvent('route_click', first)],
      'redirect'
    )
    await recordAt(
      tenantId,
      at(2),
      bystander,
      [establishmentEvent('route_click', first)],
      'redirect'
    )
    // A crawler following every outbound link, several times, and searching.
    for (const seconds of [0, 31, 62]) {
      await recordAt(
        tenantId,
        at(3, seconds),
        crawler,
        [establishmentEvent('route_click', first)],
        'redirect'
      )
    }
    for (const seconds of [0, 31]) {
      await recordAt(
        tenantId,
        at(3, seconds),
        crawler,
        [establishmentEvent('website_click', first)],
        'redirect'
      )
    }
    await recordAt(tenantId, at(3), crawler, [
      noResultSearch(first, 'café vegano'),
      noResultSearch(first, 'roteiro automatizado'),
    ])
    await recordAt(
      tenantId,
      day.plus({ days: 1 }),
      crawler,
      [establishmentEvent('route_click', first)],
      'redirect'
    )
    await recordAt(tenantId, at(5), otherCrawler, [
      establishmentEvent('establishment_view', second),
    ])

    await assertAggregatesMatchRecomputation(assert, tenantId)
    const before = await analyticsState(tenantId)
    const retention = await app.container.make(AnalyticsRetentionService)

    // Repeated and differently written names are one session each.
    const dryRun = await retention.discardSessions(
      [crawler, otherCrawler, ` ${crawler.toUpperCase()} `],
      { apply: false }
    )
    assert.deepEqual(dryRun, {
      applied: false,
      sessions_requested: 2,
      sessions_found: 2,
      raw_events_deleted: 9,
      raw_events_by_type: {
        route_click: 4,
        website_click: 2,
        search_without_results: 2,
        establishment_view: 1,
      },
      metric_sessions_deleted: 4,
      metrics_adjusted: 2,
      metrics_deleted: 2,
      search_sessions_deleted: 2,
      search_terms_adjusted: 1,
      search_terms_deleted: 1,
      aggregate_sessions_without_raw_events: 0,
    })
    assert.deepEqual(await analyticsState(tenantId), before, 'a dry run changes nothing')

    const applied = await retention.discardSessions([crawler, otherCrawler], { apply: true })
    assert.deepEqual(applied, { ...dryRun, applied: true })

    const after = await analyticsState(tenantId)
    const discarded = [crawler, otherCrawler]
    assert.deepEqual(after.events, without(before.events, discarded))
    assert.deepEqual(after.metricSessions, without(before.metricSessions, discarded))
    assert.deepEqual(after.searchSessions, without(before.searchSessions, discarded))
    await assertAggregatesMatchRecomputation(assert, tenantId)

    // Rows only crawlers produced are gone; shared rows keep the people's share.
    const routeClicks = after.metrics.filter(
      (row: any) => row.event_type === 'route_click' && row.source === 'redirect'
    )
    assert.lengthOf(routeClicks, 1)
    assert.include(routeClicks[0], { event_count: 2, unique_sessions: 2 })
    assert.isFalse(after.metrics.some((row: any) => row.event_type === 'website_click'))
    assert.lengthOf(after.searchTerms, 1)
    assert.include(after.searchTerms[0], { event_count: 1, unique_sessions: 1 })
    // Rows the crawlers never contributed to are exactly as they were.
    const shared = (row: any) =>
      (row.event_type === 'route_click' && row.source === 'redirect') ||
      (row.event_type === 'establishment_view' && row.establishment_id === second.id)
    assert.deepEqual(
      after.metrics.filter((row: any) => !shared(row)),
      before.metrics.filter((row: any) => !shared(row) && row.event_type !== 'website_click')
    )

    // Idempotent: a second run finds nothing and changes nothing.
    const repeated = await retention.discardSessions([crawler, otherCrawler], { apply: true })
    assert.deepEqual(repeated, {
      applied: true,
      sessions_requested: 2,
      sessions_found: 0,
      raw_events_deleted: 0,
      raw_events_by_type: {},
      metric_sessions_deleted: 0,
      metrics_adjusted: 0,
      metrics_deleted: 0,
      search_sessions_deleted: 0,
      search_terms_adjusted: 0,
      search_terms_deleted: 0,
      aggregate_sessions_without_raw_events: 0,
    })
    assert.deepEqual(await analyticsState(tenantId), after)
  })

  test('leaves session days past raw retention untouched and reports them', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('analytics-discard-retained')
    const published = await completeAndPublish(client, scenario, 'Café Retenção Regional')
    const tenantId = scenario.tenant.id
    const [person, crawler] = [sessionHash(), sessionHash()]
    const day = DateTime.utc()
      .minus({ days: 2 })
      .set({ hour: 15, minute: 0, second: 0, millisecond: 0 })

    await recordAt(tenantId, day, person, [establishmentEvent('establishment_view', published)])
    await recordAt(tenantId, day, crawler, [establishmentEvent('establishment_view', published)])
    // Retention already removed the crawler's raw event; its daily session row remains.
    await db.transaction(async (transaction) => {
      await transaction.rawQuery("SELECT set_config('app.analytics_retention', 'on', true)")
      await transaction
        .from('analytics_events')
        .where('tenant_id', tenantId)
        .where('anonymous_session_hash', crawler)
        .delete()
    })
    const before = await analyticsState(tenantId)

    const retention = await app.container.make(AnalyticsRetentionService)
    const result = await retention.discardSessions([crawler], { apply: true })

    assert.equal(result.sessions_found, 0)
    assert.equal(result.raw_events_deleted, 0)
    assert.equal(result.aggregate_sessions_without_raw_events, 1)
    assert.deepEqual(await analyticsState(tenantId), before)
  })

  test('the command refuses partial hashes, dry-runs by default and prints counts only', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('analytics-discard-command')
    const published = await completeAndPublish(client, scenario, 'Café Comando Regional')
    const tenantId = scenario.tenant.id
    const [person, crawler] = [sessionHash(), sessionHash()]
    const day = DateTime.utc()
      .minus({ days: 1 })
      .set({ hour: 15, minute: 0, second: 0, millisecond: 0 })
    await recordAt(
      tenantId,
      day,
      person,
      [establishmentEvent('route_click', published)],
      'redirect'
    )
    await recordAt(
      tenantId,
      day,
      crawler,
      [establishmentEvent('route_click', published)],
      'redirect'
    )
    const before = await analyticsState(tenantId)

    async function run(...argv: string[]) {
      const command = await ace.create(DiscardAnalyticsSessions, argv)
      const messages: string[] = []
      for (const method of ['error', 'warning', 'success', 'info'] as const) {
        mock.method(command.logger, method, (message: string) => {
          messages.push(message)
        })
      }
      await command.exec()
      return { code: command.exitCode ?? 0, output: messages.join('\n') }
    }

    for (const partial of [
      crawler.slice(0, 12),
      crawler.slice(0, 63),
      `${crawler}0`,
      'g'.repeat(64),
      '',
    ]) {
      const refused = await run('--session', crawler, '--session', partial, '--apply')
      assert.equal(refused.code, 1, partial)
      assert.include(refused.output, 'Session #2 is not a full 64-character hexadecimal hash')
    }
    await assert.rejects(
      () =>
        app.container
          .make(AnalyticsRetentionService)
          .then((s) => s.discardSessions([], { apply: true })),
      BadRequestException
    )
    assert.deepEqual(await analyticsState(tenantId), before, 'refusals change nothing')

    const dryRun = await run('--session', crawler)
    assert.equal(dryRun.code, 0)
    assert.include(dryRun.output, 'sessions: 1 named, 1 with raw events')
    assert.include(dryRun.output, 'raw events: 1 (route_click 1)')
    assert.include(dryRun.output, 'Dry run: nothing was changed')
    assert.notMatch(dryRun.output, /[0-9a-f]{64}/i, 'no session hash is ever printed')
    assert.deepEqual(await analyticsState(tenantId), before)

    const applied = await run(`--session=${crawler}`, '--apply')
    assert.equal(applied.code, 0)
    assert.include(applied.output, 'Applied')
    assert.notMatch(applied.output, /[0-9a-f]{64}/i)
    const after = await analyticsState(tenantId)
    assert.deepEqual(after.events, without(before.events, [crawler]))
    await assertAggregatesMatchRecomputation(assert, tenantId)
  })
})
