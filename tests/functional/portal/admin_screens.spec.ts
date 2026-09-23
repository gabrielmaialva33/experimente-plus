import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import IRoles from '#modules/roles/interfaces/role_interface'
import { createEstablishmentScenario } from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

async function staff(prefix: string) {
  const scenario = await createEstablishmentScenario(prefix)
  const admin = await createUser({
    prefix: `${prefix}-admin`,
    tenant: scenario.tenant,
    tenantRole: 'admin',
    globalRole: IRoles.Slugs.ADMIN,
  })
  const moderator = await createUser({
    prefix: `${prefix}-moderator`,
    tenant: scenario.tenant,
    globalRole: IRoles.Slugs.MODERATOR,
  })
  return { scenario, admin, moderator, headers: tenantHeader(scenario.tenant.id) }
}

test.group('Backoffice administration screens (Anexo I item 12)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the review policy screen is for administrators only', async ({ client, assert }) => {
    const { scenario, admin, moderator, headers } = await staff('adm-policy-access')

    for (const outsider of [scenario.owner, moderator]) {
      const denied = await client
        .get('/backoffice/review-policy')
        .headers(headers)
        .loginAs(outsider)
      denied.assertStatus(403)
    }

    const page = await client.get('/backoffice/review-policy').headers(headers).loginAs(admin)
    page.assertStatus(200)
    assert.include(page.text(), 'backoffice/review_policy/index')
    assert.include(page.text(), '"max_text_length"')
    assert.equal(page.header('cache-control'), 'private, no-store')
    assert.equal(page.header('x-robots-tag'), 'noindex, nofollow')
  })

  test('saving the review policy through the screen persists it', async ({ client, assert }) => {
    const { scenario, admin, headers } = await staff('adm-policy-save')

    const saved = await client
      .put('/backoffice/review-policy')
      .headers(headers)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ min_text_length: 20, max_text_length: 600, max_photos: 3, require_visit_proof: true })
    assert.oneOf(saved.status(), [200, 302])

    const row = await db.from('review_policies').where('tenant_id', scenario.tenant.id).first()
    assert.equal(row.min_text_length, 20)
    assert.equal(row.max_text_length, 600)
    assert.equal(row.max_photos, 3)
    assert.isTrue(row.require_visit_proof)
  })

  test('an inverted text range is a validation error, not a database failure', async ({
    client,
    assert,
  }) => {
    // The table's check used to surface as a 500. The rule now lives in the
    // service, so both the API and the screen report it on the field.
    const { scenario, admin, headers } = await staff('adm-policy-range')

    const api = await client
      .put('/api/v1/admin/review-policy')
      .headers(headers)
      .loginAs(admin)
      .json({ min_text_length: 500, max_text_length: 100 })
    api.assertStatus(422)

    // Only one bound sent: still compared against the stored other bound.
    const halfApi = await client
      .put('/api/v1/admin/review-policy')
      .headers(headers)
      .loginAs(admin)
      .json({ min_text_length: 5000 })
    halfApi.assertStatus(422)

    const screen = await client
      .put('/backoffice/review-policy')
      .headers({ ...headers, referer: '/backoffice/review-policy' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ min_text_length: 500, max_text_length: 100 })
    assert.oneOf(screen.status(), [302, 422])

    const row = await db.from('review_policies').where('tenant_id', scenario.tenant.id).first()
    assert.isAtMost(row.min_text_length, row.max_text_length)
    assert.notEqual(row.min_text_length, 500)
  })

  test('the taxonomy screen lists and writes through the web routes', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, moderator, headers } = await staff('adm-taxonomy')

    const denied = await client.get('/backoffice/taxonomy').headers(headers).loginAs(moderator)
    denied.assertStatus(403)
    const partner = await client
      .get('/backoffice/taxonomy')
      .headers(headers)
      .loginAs(scenario.owner)
    partner.assertStatus(403)

    const page = await client.get('/backoffice/taxonomy').headers(headers).loginAs(admin)
    page.assertStatus(200)
    assert.include(page.text(), 'backoffice/taxonomy/index')
    assert.include(page.text(), scenario.family.name)
    assert.include(page.text(), scenario.primaryCategory.name)

    const createdFamily = await client
      .post('/backoffice/taxonomy/families')
      .headers(headers)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Lazer e cultura', sort_order: 2 })
    assert.oneOf(createdFamily.status(), [200, 302])
    const family = await db
      .from('category_families')
      .where('tenant_id', scenario.tenant.id)
      .where('name', 'Lazer e cultura')
      .first()
    assert.exists(family)
    assert.isString(family.slug)

    const createdCategory = await client
      .post('/backoffice/taxonomy/categories')
      .headers(headers)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ family_id: family.id, name: 'Museus' })
    assert.oneOf(createdCategory.status(), [200, 302])
    const category = await db
      .from('categories')
      .where('tenant_id', scenario.tenant.id)
      .where('name', 'Museus')
      .first()
    assert.equal(category.family_id, family.id)

    const deactivated = await client
      .put(`/backoffice/taxonomy/categories/${category.id}`)
      .headers(headers)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ is_active: false })
    assert.oneOf(deactivated.status(), [200, 302])
    const after = await db.from('categories').where('id', category.id).first()
    assert.isFalse(after.is_active)
  })

  test('a moderator cannot write taxonomy through the web routes either', async ({
    client,
    assert,
  }) => {
    const { scenario, moderator, headers } = await staff('adm-taxonomy-write')

    const attempt = await client
      .post('/backoffice/taxonomy/families')
      .headers(headers)
      .loginAs(moderator)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Família indevida' })
    attempt.assertStatus(403)

    const row = await db
      .from('category_families')
      .where('tenant_id', scenario.tenant.id)
      .where('name', 'Família indevida')
      .first()
    assert.notExists(row)
  })

  test('the geography screen lists and writes regions and cities', async ({ client, assert }) => {
    const { scenario, admin, headers } = await staff('adm-geography')

    const partner = await client
      .get('/backoffice/geography')
      .headers(headers)
      .loginAs(scenario.owner)
    partner.assertStatus(403)

    const page = await client.get('/backoffice/geography').headers(headers).loginAs(admin)
    page.assertStatus(200)
    assert.include(page.text(), 'backoffice/geography/index')
    assert.include(page.text(), scenario.city.name)

    await client
      .post('/backoffice/geography/regions')
      .headers(headers)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Campos Gerais' })
    const region = await db
      .from('regions')
      .where('tenant_id', scenario.tenant.id)
      .where('name', 'Campos Gerais')
      .first()
    assert.exists(region)

    await client
      .post('/backoffice/geography/cities')
      .headers(headers)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({
        region_id: region.id,
        name: 'Ponta Grossa',
        state_code: 'PR',
        timezone: 'America/Sao_Paulo',
        ibge_code: '4119905',
      })
    const city = await db
      .from('cities')
      .where('tenant_id', scenario.tenant.id)
      .where('name', 'Ponta Grossa')
      .first()
    assert.equal(city.region_id, region.id)
    assert.equal(city.ibge_code, '4119905')

    await client
      .put(`/backoffice/geography/cities/${city.id}`)
      .headers(headers)
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ is_active: false })
    const after = await db.from('cities').where('id', city.id).first()
    assert.isFalse(after.is_active)
  })

  test('an invalid city is refused by the same validator as the API', async ({
    client,
    assert,
  }) => {
    const { scenario, admin, headers } = await staff('adm-geography-invalid')

    await client
      .post('/backoffice/geography/cities')
      .headers({ ...headers, referer: '/backoffice/geography' })
      .loginAs(admin)
      .withCsrfToken()
      .redirects(0)
      .json({ region_id: scenario.region.id, name: 'Cidade sem UF', ibge_code: '12' })

    const row = await db
      .from('cities')
      .where('tenant_id', scenario.tenant.id)
      .where('name', 'Cidade sem UF')
      .first()
    assert.notExists(row)
  })
})
