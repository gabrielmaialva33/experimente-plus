import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { ANALYTICS_SESSION_COOKIE } from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsDailyMetric from '#modules/analytics/models/analytics_daily_metric'
import AnalyticsDailySearchTerm from '#modules/analytics/models/analytics_daily_search_term'
import AnalyticsEvent from '#modules/analytics/models/analytics_event'
import AnalyticsRetentionService from '#modules/analytics/services/analytics_retention_service'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { addOrganizationMember, createUser } from '#tests/functional/organizations/helpers'

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
      analyticsEvent('catalog_impression', published),
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
    editorDashboard.assertStatus(200)

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
