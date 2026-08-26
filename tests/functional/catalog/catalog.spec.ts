import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const fixture = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'media', name)
const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })
const publicHeaders = (scenario: EstablishmentScenario) => ({
  'host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-for': `198.51.100.${(scenario.tenant.id % 250) + 1}`,
})

interface TestInertiaPage {
  component: string
  props: Record<string, unknown>
}

function parseInertiaPage(response: { text(): string }): TestInertiaPage {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)

  if (!match?.[1]) {
    throw new Error('The response does not contain an Inertia page payload')
  }

  return JSON.parse(match[1]) as TestInertiaPage
}

async function createDraftEstablishment(
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
      short_description: `Descubra ${publicName} e seus destaques regionais`,
      description: `${publicName} é uma unidade usada para validar o catálogo público regional.`,
      public_phone: '(43) 99999-0000',
      whatsapp: '(43) 99999-0000',
      public_email: 'catalogo@example.test',
      website: 'https://example.test',
      instagram: 'catalogo-regional',
      availability_type: 'regular_hours',
    })

  response.assertStatus(201)
  return Number(response.body().id)
}

async function completeProfile(
  client: ApiClient,
  scenario: EstablishmentScenario,
  establishmentId: number
): Promise<number> {
  const weekday = DateTime.now().setZone(scenario.city.timezone).weekday % 7

  const address = await client
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
    })
  address.assertStatus(200)

  const categories = await client
    .put(`/api/v1/establishments/${establishmentId}/categories`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .json({
      categories: [{ category_id: scenario.primaryCategory.id, is_primary: true }],
    })
  categories.assertStatus(200)

  const attributes = await client
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
    })
  attributes.assertStatus(200)

  const hours = await client
    .put(`/api/v1/establishments/${establishmentId}/hours`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .json({
      hours: [{ weekday, opens_at: '00:00', closes_at: '23:59' }],
    })
  hours.assertStatus(200)

  const media = await client
    .post(`/api/v1/establishments/${establishmentId}/media`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
    .field('alt_text', 'Fachada principal da unidade')
    .field('is_cover', 'true')
    .file('file', fixture('valid.png'))
  media.assertStatus(201)

  return Number(media.body().id)
}

async function createModerator(scenario: EstablishmentScenario) {
  return createUser({
    prefix: 'catalog-moderator',
    tenant: scenario.tenant,
    tenantRole: 'member',
    globalRole: IRoles.Slugs.MODERATOR,
  })
}

async function createAdministrator(scenario: EstablishmentScenario) {
  return createUser({
    prefix: 'catalog-admin',
    tenant: scenario.tenant,
    tenantRole: 'member',
    globalRole: IRoles.Slugs.ADMIN,
  })
}

async function publishEstablishment(
  client: ApiClient,
  scenario: EstablishmentScenario,
  establishmentId: number,
  mediaId: number
): Promise<EstablishmentRevision> {
  const moderator = await createModerator(scenario)

  const submitted = await client
    .post(`/api/v1/establishments/${establishmentId}/submit`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(scenario.owner)
  submitted.assertStatus(200)

  const revision = await EstablishmentRevision.query()
    .where('tenant_id', scenario.tenant.id)
    .where('establishment_id', establishmentId)
    .where('status', 'pending_review')
    .firstOrFail()

  const approvedMedia = await client
    .post(`/api/v1/admin/media/${mediaId}/approve`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(moderator)
    .json({})
  approvedMedia.assertStatus(200)

  const approved = await client
    .post(`/api/v1/admin/establishment-revisions/${revision.id}/approve`)
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(moderator)
    .json({ reason: 'Conteúdo adequado ao catálogo regional' })
  approved.assertStatus(200)

  await revision.refresh()
  return revision
}

async function createPublishedEstablishment(
  client: ApiClient,
  scenario: EstablishmentScenario,
  publicName: string
) {
  const establishmentId = await createDraftEstablishment(client, scenario, publicName)
  const mediaId = await completeProfile(client, scenario, establishmentId)
  const revision = await publishEstablishment(client, scenario, establishmentId, mediaId)

  return { establishmentId, mediaId, revision }
}

test.group('Public catalog', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(async () => {
    await rm(app.makePath('storage', 'media'), { recursive: true, force: true })
  })

  test('keeps drafts private and exposes an allowlisted projection after atomic publication', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('catalog-publication')
    const establishmentId = await createDraftEstablishment(
      client,
      scenario,
      'Café Horizonte Regional'
    )
    const mediaId = await completeProfile(client, scenario, establishmentId)

    const beforePublication = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments`)
      .headers(publicHeaders(scenario))
    beforePublication.assertStatus(200)
    assert.lengthOf(beforePublication.body().organic_results, 0)

    const revision = await publishEstablishment(client, scenario, establishmentId, mediaId)

    const cities = await client.get('/api/v1/catalog/cities').headers(publicHeaders(scenario))
    cities.assertStatus(200)
    assert.include(
      cities.body().map((city: { slug: string }) => city.slug),
      scenario.city.slug
    )
    const city = cities.body().find((item: { slug: string }) => item.slug === scenario.city.slug)
    assert.equal(city.establishments_count, 1)
    assert.notProperty(city, 'tenant_id')
    assert.notProperty(city, 'id')

    const categories = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/categories`)
      .headers(publicHeaders(scenario))
    categories.assertStatus(200)
    assert.equal(categories.body().categories[0].slug, scenario.primaryCategory.slug)
    assert.equal(categories.body().categories[0].establishments_count, 1)

    const search = await client
      .get(
        `/api/v1/catalog/cities/${scenario.city.slug}/establishments?q=cafe+horizonte&open_now=true`
      )
      .headers(publicHeaders(scenario))
    search.assertStatus(200)
    assert.equal(search.body().meta.total, 1)
    assert.lengthOf(search.body().organic_results, 1)
    search.assertBodyContains({
      organic_results: [
        {
          slug: revision.slug,
          name: 'Café Horizonte Regional',
          business_status: 'open',
          is_open_now: true,
          is_sponsored: false,
        },
      ],
    })

    const result = search.body().organic_results[0]
    assert.notProperty(result, 'tenant_id')
    assert.notProperty(result, 'organization_id')
    assert.notProperty(result, 'published_revision_id')
    assert.notProperty(result, 'review_notes')
    assert.notProperty(result.cover.asset, 'checksum_sha256')

    const detail = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments/${revision.slug}`)
      .headers(publicHeaders(scenario))
    detail.assertStatus(200)
    detail.assertBodyContains({
      slug: revision.slug,
      name: 'Café Horizonte Regional',
      city: { slug: scenario.city.slug },
      address: { district: 'Centro' },
      contacts: { email: 'catalogo@example.test' },
      is_open_now: true,
    })
    assert.notProperty(detail.body(), 'tenant_id')
    assert.notProperty(detail.body(), 'reviewed_by')
    assert.notProperty(detail.body(), 'review_notes')

    // catalog SSR pages expose the published projection through the operation hostname
    const publicRow = await db
      .from('establishment_revisions as revision')
      .join('cities as city', 'city.id', 'revision.city_id')
      .join(
        'establishment_revision_categories as revision_category',
        'revision_category.revision_id',
        'revision.id'
      )
      .join('categories as category', 'category.id', 'revision_category.category_id')
      .where('revision.establishment_id', establishmentId)
      .where('revision.status', 'approved')
      .where('revision_category.is_primary', true)
      .select(
        'revision.public_name',
        'revision.slug as establishment_slug',
        'city.name as city_name',
        'city.slug as city_slug',
        'category.name as category_name',
        'category.slug as category_slug'
      )
      .first()

    assert.exists(publicRow)
    const published = publicRow!

    const citiesPage = await client.get('/cidades').headers(publicHeaders(scenario))
    citiesPage.assertStatus(200)
    const citiesInertia = parseInertiaPage(citiesPage)
    assert.equal(citiesInertia.component, 'catalog/cities')
    assert.include(JSON.stringify(citiesInertia.props.catalog), published.city_name)

    const cityPage = await client
      .get(`/cidades/${published.city_slug}`)
      .headers(publicHeaders(scenario))
    cityPage.assertStatus(200)
    const cityInertia = parseInertiaPage(cityPage)
    assert.equal(cityInertia.component, 'catalog/establishments')
    assert.equal(cityInertia.props.city_slug, published.city_slug)
    assert.include(JSON.stringify(cityInertia.props.catalog), published.public_name)
    assert.include(JSON.stringify(cityInertia.props.filter_categories), published.category_name)

    const filteredCityPage = await client
      .get(`/cidades/${published.city_slug}?category=${published.category_slug}`)
      .headers(publicHeaders(scenario))
    filteredCityPage.assertStatus(200)
    const filteredCityInertia = parseInertiaPage(filteredCityPage)
    assert.equal(filteredCityInertia.component, 'catalog/establishments')
    assert.equal(
      (filteredCityInertia.props.catalog as { query?: { category?: string } }).query?.category,
      published.category_slug
    )
    assert.include(JSON.stringify(filteredCityInertia.props.catalog), published.public_name)

    const categoriesPage = await client
      .get(`/cidades/${published.city_slug}/categorias`)
      .headers(publicHeaders(scenario))
    categoriesPage.assertStatus(200)
    const categoriesInertia = parseInertiaPage(categoriesPage)
    assert.equal(categoriesInertia.component, 'catalog/categories')
    assert.equal(categoriesInertia.props.city_slug, published.city_slug)
    assert.include(JSON.stringify(categoriesInertia.props.catalog), published.category_name)

    const categoryPage = await client
      .get(`/cidades/${published.city_slug}/categorias/${published.category_slug}`)
      .headers(publicHeaders(scenario))
    categoryPage.assertStatus(200)
    const categoryInertia = parseInertiaPage(categoryPage)
    assert.equal(categoryInertia.component, 'catalog/category')
    assert.equal(categoryInertia.props.city_slug, published.city_slug)
    assert.equal(categoryInertia.props.category_slug, published.category_slug)
    assert.equal(
      (categoryInertia.props.catalog as { query?: { category?: string } }).query?.category,
      published.category_slug
    )
    assert.include(JSON.stringify(categoryInertia.props.catalog), published.public_name)

    const detailPage = await client
      .get(`/cidades/${published.city_slug}/estabelecimentos/${published.establishment_slug}`)
      .headers(publicHeaders(scenario))
    detailPage.assertStatus(200)
    const detailInertia = parseInertiaPage(detailPage)
    assert.equal(detailInertia.component, 'catalog/establishment')
    assert.equal(detailInertia.props.city_slug, published.city_slug)
    assert.include(JSON.stringify(detailInertia.props.catalog), published.public_name)
  })

  test('supports deterministic text, typo, category and pagination filters', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('catalog-search')
    const first = await createPublishedEstablishment(client, scenario, 'Café Aurora Especial')
    const second = await createPublishedEstablishment(client, scenario, 'Café Brisa do Norte')
    const third = await createPublishedEstablishment(client, scenario, 'Padaria Central Regional')

    const exact = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments?q=cafe+aurora`)
      .headers(publicHeaders(scenario))
    exact.assertStatus(200)
    assert.equal(exact.body().organic_results[0].slug, first.revision.slug)

    const typo = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments?q=orizonte`)
      .headers(publicHeaders(scenario))
    typo.assertStatus(200)
    assert.isArray(typo.body().organic_results)

    const category = await client
      .get(
        `/api/v1/catalog/cities/${scenario.city.slug}/establishments?category=${scenario.primaryCategory.slug}`
      )
      .headers(publicHeaders(scenario))
    category.assertStatus(200)
    assert.equal(category.body().meta.total, 3)

    const firstPage = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments?per_page=2&page=1`)
      .headers(publicHeaders(scenario))
    const secondPage = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments?per_page=2&page=2`)
      .headers(publicHeaders(scenario))
    firstPage.assertStatus(200)
    secondPage.assertStatus(200)
    assert.equal(firstPage.body().meta.total, 3)
    assert.equal(firstPage.body().meta.last_page, 2)
    assert.lengthOf(firstPage.body().organic_results, 2)
    assert.lengthOf(secondPage.body().organic_results, 1)

    const allSlugs = [
      ...firstPage.body().organic_results,
      ...secondPage.body().organic_results,
    ].map((item: { slug: string }) => item.slug)
    assert.sameMembers(allSlugs, [first.revision.slug, second.revision.slug, third.revision.slug])
  })

  test('removes suspended units immediately and restores the same published revision', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('catalog-lifecycle')
    const { establishmentId, revision } = await createPublishedEstablishment(
      client,
      scenario,
      'Restaurante Ciclo Público'
    )
    const administrator = await createAdministrator(scenario)

    const visible = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments/${revision.slug}`)
      .headers(publicHeaders(scenario))
    visible.assertStatus(200)

    const suspended = await client
      .post(`/api/v1/admin/establishments/${establishmentId}/suspend`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(administrator)
      .json({ reason: 'Verificação administrativa temporária' })
    suspended.assertStatus(200)

    const hidden = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments/${revision.slug}`)
      .headers(publicHeaders(scenario))
    hidden.assertStatus(404)

    const restored = await client
      .post(`/api/v1/admin/establishments/${establishmentId}/restore`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(administrator)
      .json({ reason: 'Verificação concluída' })
    restored.assertStatus(200)

    const visibleAgain = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments/${revision.slug}`)
      .headers(publicHeaders(scenario))
    visibleAgain.assertStatus(200)

    const establishment = await Establishment.findOrFail(establishmentId)
    assert.equal(establishment.published_revision_id, revision.id)
  })

  test('keeps operations isolated by hostname and never leaks another tenant catalog', async ({
    client,
    assert,
  }) => {
    const first = await createEstablishmentScenario('catalog-tenant-first')
    const second = await createEstablishmentScenario('catalog-tenant-second')
    const firstPublished = await createPublishedEstablishment(client, first, 'Café Primeiro Tenant')
    const secondPublished = await createPublishedEstablishment(
      client,
      second,
      'Café Segundo Tenant'
    )

    const firstSearch = await client
      .get(`/api/v1/catalog/cities/${first.city.slug}/establishments`)
      .headers(publicHeaders(first))
    firstSearch.assertStatus(200)
    assert.deepEqual(
      firstSearch.body().organic_results.map((item: { slug: string }) => item.slug),
      [firstPublished.revision.slug]
    )

    const crossTenant = await client
      .get(
        `/api/v1/catalog/cities/${first.city.slug}/establishments/${firstPublished.revision.slug}`
      )
      .headers(publicHeaders(second))
    crossTenant.assertStatus(404)

    const secondSearch = await client
      .get(`/api/v1/catalog/cities/${second.city.slug}/establishments`)
      .headers(publicHeaders(second))
    secondSearch.assertStatus(200)
    assert.deepEqual(
      secondSearch.body().organic_results.map((item: { slug: string }) => item.slug),
      [secondPublished.revision.slug]
    )
  })

  test('calculates regular, overnight, special and appointment availability in PostgreSQL', async ({
    assert,
  }) => {
    const regular = await db.rawQuery<{ rows: Array<{ open: boolean }> }>(
      `
        SELECT catalog_is_open_now(
          'regular_hours',
          'open',
          'America/Sao_Paulo',
          '[{"weekday":1,"opens_at":"08:00","closes_at":"18:00","spans_next_day":false}]'::jsonb,
          '[]'::jsonb,
          '2026-08-24T15:00:00Z'::timestamptz
        ) AS open
      `
    )
    assert.isTrue(regular.rows[0].open)

    const overnight = await db.rawQuery<{ rows: Array<{ open: boolean }> }>(
      `
        SELECT catalog_is_open_now(
          'regular_hours',
          'open',
          'America/Sao_Paulo',
          '[{"weekday":5,"opens_at":"18:00","closes_at":"02:00","spans_next_day":true}]'::jsonb,
          '[]'::jsonb,
          '2026-08-29T04:00:00Z'::timestamptz
        ) AS open
      `
    )
    assert.isTrue(overnight.rows[0].open)

    const closedByException = await db.rawQuery<{ rows: Array<{ open: boolean }> }>(
      `
        SELECT catalog_is_open_now(
          'always_open',
          'open',
          'America/Sao_Paulo',
          '[]'::jsonb,
          '[{"date":"2026-08-24","status":"closed","intervals":[]}]'::jsonb,
          '2026-08-24T15:00:00Z'::timestamptz
        ) AS open
      `
    )
    assert.isFalse(closedByException.rows[0].open)

    const appointmentOnly = await db.rawQuery<{ rows: Array<{ open: boolean }> }>(
      `
        SELECT catalog_is_open_now(
          'appointment_only',
          'open',
          'America/Sao_Paulo',
          '[]'::jsonb,
          '[]'::jsonb,
          '2026-08-24T15:00:00Z'::timestamptz
        ) AS open
      `
    )
    assert.isFalse(appointmentOnly.rows[0].open)
  })

  test('keeps a permanently closed unit only as a minimal historical page', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('catalog-closed')
    const { establishmentId, revision } = await createPublishedEstablishment(
      client,
      scenario,
      'Casa Encerrada'
    )

    const closed = await client
      .patch(`/api/v1/establishments/${establishmentId}/business-status`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ business_status: 'permanently_closed' })
    closed.assertStatus(200)

    const search = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments`)
      .headers(publicHeaders(scenario))
    search.assertStatus(200)
    assert.lengthOf(search.body().organic_results, 0)

    const detail = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments/${revision.slug}`)
      .headers(publicHeaders(scenario))
    detail.assertStatus(200)
    detail.assertBodyContains({
      slug: revision.slug,
      name: 'Casa Encerrada',
      business_status: 'permanently_closed',
      historical: true,
    })
    assert.notProperty(detail.body(), 'contacts')
    assert.notProperty(detail.body(), 'media')
    assert.notProperty(detail.body(), 'address')
  })

  test('rebuilds the projection when media eligibility changes after publication', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('catalog-media-refresh')
    const { mediaId, revision } = await createPublishedEstablishment(
      client,
      scenario,
      'Galeria Moderada'
    )
    const moderator = await createModerator(scenario)

    const rejected = await client
      .post(`/api/v1/admin/media/${mediaId}/reject`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Imagem removida após nova análise' })
    rejected.assertStatus(200)

    const hidden = await client
      .get(`/api/v1/catalog/cities/${scenario.city.slug}/establishments/${revision.slug}`)
      .headers(publicHeaders(scenario))
    hidden.assertStatus(404)

    const media = await EstablishmentRevisionMedia.findOrFail(mediaId)
    assert.equal(media.moderation_status, 'rejected')
  })
})
