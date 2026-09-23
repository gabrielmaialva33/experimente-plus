import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import type Establishment from '#modules/establishments/models/establishment'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import IRoles from '#modules/roles/interfaces/role_interface'
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

async function review(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  userId: number,
  rating: number,
  status: 'published' | 'hidden' = 'published'
) {
  return EstablishmentReview.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    user_id: userId,
    rating,
    comment: `Avaliação ${rating}`,
    status,
    photos_count: 0,
    videos_count: 0,
  })
}

async function aggregate(scenario: EstablishmentScenario, establishment: Establishment) {
  const row = await db
    .from('catalog_establishments')
    .where('tenant_id', scenario.tenant.id)
    .where('establishment_id', establishment.id)
    .select('reviews_count', 'reviews_average')
    .first()
  return {
    count: Number(row.reviews_count),
    average: row.reviews_average === null ? null : Number(row.reviews_average),
  }
}

async function moderatorIn(scenario: EstablishmentScenario) {
  return createUser({
    prefix: 'ban-moderator',
    tenant: scenario.tenant,
    globalRole: IRoles.Slugs.MODERATOR,
  })
}

test.group('User bans (ADR-0027 §6, Anexo I items 8 and 14)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a ban hides the reviews and the average, and lifting it restores both', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('ban-scenario7')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'ban-author', tenant: scenario.tenant })
    const other = await createUser({ prefix: 'ban-other', tenant: scenario.tenant })
    const moderator = await moderatorIn(scenario)

    await review(scenario, establishment, author.id, 1)
    await review(scenario, establishment, other.id, 5)
    assert.deepEqual(await aggregate(scenario, establishment), { count: 2, average: 3 })

    const banned = await client
      .post(`/api/v1/admin/users/${author.id}/ban`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Ofensas repetidas a estabelecimentos.' })
    banned.assertStatus(200)
    banned.assertBodyContains({ user_id: author.id, banned: true })

    const listed = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
      .headers(publicHeaders(scenario))
    assert.deepEqual(
      listed.body().data.map((item: any) => item.rating),
      [5]
    )
    assert.deepEqual(await aggregate(scenario, establishment), { count: 1, average: 5 })

    const lifted = await client
      .post(`/api/v1/admin/users/${author.id}/unban`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Recurso aceito.' })
    lifted.assertBodyContains({ banned: false })

    assert.deepEqual(await aggregate(scenario, establishment), { count: 2, average: 3 })
    const restored = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
      .headers(publicHeaders(scenario))
    assert.lengthOf(restored.body().data, 2)
  })

  test('lifting a ban does not republish what a moderator hid on its merits', async ({
    client,
    assert,
  }) => {
    // The property the read-time design exists for. Had the ban rewritten
    // statuses, unbanning could not tell these two reviews apart.
    const scenario = await createEstablishmentScenario('ban-merits')
    const first = await createPublishedEstablishment(scenario, 'Primeiro Lugar')
    const second = await createPublishedEstablishment(scenario, 'Segundo Lugar')
    const author = await createUser({ prefix: 'ban-merits-author', tenant: scenario.tenant })
    const moderator = await moderatorIn(scenario)

    await review(scenario, first, author.id, 4)
    const hiddenOnMerits = await review(scenario, second, author.id, 1, 'hidden')

    const headers = tenantHeader(scenario.tenant.id)
    await client
      .post(`/api/v1/admin/users/${author.id}/ban`)
      .headers(headers)
      .loginAs(moderator)
      .json({ reason: 'Teste de restauração.' })
    await client
      .post(`/api/v1/admin/users/${author.id}/unban`)
      .headers(headers)
      .loginAs(moderator)
      .json({})

    await hiddenOnMerits.refresh()
    assert.equal(hiddenOnMerits.status, 'hidden')
    assert.deepEqual(await aggregate(scenario, second), { count: 0, average: null })
    assert.deepEqual(await aggregate(scenario, first), { count: 1, average: 4 })
  })

  test('a ban in one operation does not silence the person in another', async ({
    client,
    assert,
  }) => {
    const alpha = await createEstablishmentScenario('ban-alpha')
    const beta = await createEstablishmentScenario('ban-beta')
    const inAlpha = await createPublishedEstablishment(alpha)
    const inBeta = await createPublishedEstablishment(beta)
    const person = await createUser({ prefix: 'ban-two-ops', tenant: alpha.tenant })
    await db.table('user_tenants').insert({
      user_id: person.id,
      tenant_id: beta.tenant.id,
      role: 'member',
      created_at: new Date(),
      updated_at: new Date(),
    })
    const moderator = await moderatorIn(alpha)

    await review(alpha, inAlpha, person.id, 2)
    await review(beta, inBeta, person.id, 3)

    await client
      .post(`/api/v1/admin/users/${person.id}/ban`)
      .headers(tenantHeader(alpha.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Somente nesta operação.' })

    assert.deepEqual(await aggregate(alpha, inAlpha), { count: 0, average: null })
    assert.deepEqual(await aggregate(beta, inBeta), { count: 1, average: 3 })
  })

  test('a banned author’s review answers as missing at its own address', async ({ client }) => {
    const scenario = await createEstablishmentScenario('ban-address')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'ban-address-author', tenant: scenario.tenant })
    const moderator = await moderatorIn(scenario)
    const written = await review(scenario, establishment, author.id, 1)

    const before = await client
      .get(`/api/v1/catalog/reviews/${written.id}`)
      .headers(publicHeaders(scenario))
    before.assertStatus(200)

    await client
      .post(`/api/v1/admin/users/${author.id}/ban`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Caminho alternativo.' })

    const after = await client
      .get(`/api/v1/catalog/reviews/${written.id}`)
      .headers(publicHeaders(scenario))
    after.assertStatus(404)
  })

  test('what a banned person writes is born outside public view', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('ban-new')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'ban-new-author', tenant: scenario.tenant })
    const moderator = await moderatorIn(scenario)

    await client
      .post(`/api/v1/admin/users/${author.id}/ban`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Antes de escrever.' })

    await review(scenario, establishment, author.id, 1)

    assert.deepEqual(await aggregate(scenario, establishment), { count: 0, average: null })
    const listed = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
      .headers(publicHeaders(scenario))
    assert.lengthOf(listed.body().data, 0)
  })

  test('rebuilding the projection from scratch keeps the ban', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('ban-rebuild')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'ban-rebuild-author', tenant: scenario.tenant })
    const other = await createUser({ prefix: 'ban-rebuild-other', tenant: scenario.tenant })
    const moderator = await moderatorIn(scenario)

    await review(scenario, establishment, author.id, 1)
    await review(scenario, establishment, other.id, 4)
    await client
      .post(`/api/v1/admin/users/${author.id}/ban`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Reconstrução.' })

    await db.rawQuery('SELECT catalog_delete_establishment(?, ?)', [
      scenario.tenant.id,
      establishment.id,
    ])
    await db.rawQuery('SELECT catalog_refresh_establishment(?, ?)', [
      scenario.tenant.id,
      establishment.id,
    ])

    assert.deepEqual(await aggregate(scenario, establishment), { count: 1, average: 4 })
  })

  test('only a moderator bans, with a reason, and never themselves', async ({ client }) => {
    const scenario = await createEstablishmentScenario('ban-guard')
    const target = await createUser({ prefix: 'ban-guard-target', tenant: scenario.tenant })
    const regular = await createUser({ prefix: 'ban-guard-regular', tenant: scenario.tenant })
    const moderator = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const byRegular = await client
      .post(`/api/v1/admin/users/${target.id}/ban`)
      .headers(headers)
      .loginAs(regular)
      .json({ reason: 'Sem autoridade.' })
    byRegular.assertStatus(403)

    const byPartner = await client
      .post(`/api/v1/admin/users/${target.id}/ban`)
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ reason: 'Parceiro não modera.' })
    byPartner.assertStatus(403)

    const withoutReason = await client
      .post(`/api/v1/admin/users/${target.id}/ban`)
      .headers(headers)
      .loginAs(moderator)
      .json({ reason: '' })
    withoutReason.assertStatus(422)

    const self = await client
      .post(`/api/v1/admin/users/${moderator.id}/ban`)
      .headers(headers)
      .loginAs(moderator)
      .json({ reason: 'Tentativa contra si.' })
    self.assertStatus(400)

    const stranger = await client
      .post('/api/v1/admin/users/2147480000/ban')
      .headers(headers)
      .loginAs(moderator)
      .json({ reason: 'Ninguém.' })
    stranger.assertStatus(404)
  })

  test('banning twice keeps who decided first and records one event', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('ban-twice')
    const target = await createUser({ prefix: 'ban-twice-target', tenant: scenario.tenant })
    const first = await moderatorIn(scenario)
    const second = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    await client
      .post(`/api/v1/admin/users/${target.id}/ban`)
      .headers(headers)
      .loginAs(first)
      .json({ reason: 'Primeira decisão.' })
    const again = await client
      .post(`/api/v1/admin/users/${target.id}/ban`)
      .headers(headers)
      .loginAs(second)
      .json({ reason: 'Segunda tentativa.' })

    again.assertBodyContains({ banned: true, banned_by: first.id, reason: 'Primeira decisão.' })

    await client
      .post(`/api/v1/admin/users/${target.id}/unban`)
      .headers(headers)
      .loginAs(second)
      .json({ reason: 'Revisto.' })

    const shown = await client
      .get(`/api/v1/admin/users/${target.id}/ban`)
      .headers(headers)
      .loginAs(first)
    shown.assertStatus(200)
    assert.deepEqual(
      shown.body().history.map((event: any) => [event.action, event.actor.id, event.reason]),
      [
        ['unbanned', second.id, 'Revisto.'],
        ['banned', first.id, 'Primeira decisão.'],
      ]
    )
  })

  test('the report queue shows the author as banned and bans through the web', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('ban-queue')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'ban-queue-author', tenant: scenario.tenant })
    const reporter = await createUser({ prefix: 'ban-queue-reporter', tenant: scenario.tenant })
    const moderator = await moderatorIn(scenario)
    const written = await review(scenario, establishment, author.id, 1)
    const headers = tenantHeader(scenario.tenant.id)

    await client
      .post('/api/v1/content-reports')
      .headers(headers)
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: written.id, reason: 'offensive' })

    const before = await client.get('/backoffice/reports').headers(headers).loginAs(moderator)
    assert.include(before.text(), `"author_id":${author.id}`)
    assert.include(before.text(), '"author_banned":false')

    const banned = await client
      .post(`/backoffice/users/${author.id}/ban`)
      .headers(headers)
      .loginAs(moderator)
      .withCsrfToken()
      .redirects(0)
      .json({ reason: 'Padrão de ofensas na fila.' })
    assert.oneOf(banned.status(), [200, 302])

    const after = await client.get('/backoffice/reports').headers(headers).loginAs(moderator)
    assert.include(after.text(), '"author_banned":true')
    assert.deepEqual(await aggregate(scenario, establishment), { count: 0, average: null })
  })
})
