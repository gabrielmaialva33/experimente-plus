import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import type Establishment from '#modules/establishments/models/establishment'
import ContentReport from '#modules/reviews/models/content_report'
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

async function setup(prefix: string) {
  const scenario = await createEstablishmentScenario(prefix)
  const establishment = await createPublishedEstablishment(scenario)
  const author = await createUser({ prefix: `${prefix}-author`, tenant: scenario.tenant })
  const moderator = await createUser({
    prefix: `${prefix}-moderator`,
    tenant: scenario.tenant,
    globalRole: IRoles.Slugs.MODERATOR,
  })
  return { scenario, establishment, author, moderator }
}

async function writeReview(
  client: any,
  scenario: EstablishmentScenario,
  establishment: Establishment,
  author: any,
  comment: string
) {
  const response = await client
    .post('/api/v1/me/reviews')
    .headers(tenantHeader(scenario.tenant.id))
    .loginAs(author)
    .json({ establishment_id: establishment.id, rating: 4, comment })
  response.assertStatus(201)
  return EstablishmentReview.findOrFail(response.body().id)
}

async function automaticReportFor(tenantId: number, targetType: string, targetId: number) {
  return ContentReport.query()
    .where('tenant_id', tenantId)
    .where('target_type', targetType)
    .where('target_id', targetId)
    .where('origin', 'automatic')
    .first()
}

async function publicReviewCount(
  client: any,
  scenario: EstablishmentScenario,
  establishment: Establishment
) {
  const response = await client
    .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
    .headers(publicHeaders(scenario))
  return response.body().data.length as number
}

test.group('Automatic moderation (ADR-0031, Anexo I item 9)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('ordinary text passes untouched and opens nothing', async ({ client, assert }) => {
    const { scenario, establishment, author } = await setup('am-clean')
    const review = await writeReview(
      client,
      scenario,
      establishment,
      author,
      'Café ótimo, R$ 10.50 o expresso, abre das 18h às 22h. CEP 86010-190.'
    )

    assert.equal(review.status, 'published')
    assert.isNull(await automaticReportFor(scenario.tenant.id, 'review', review.id))
  })

  test('a contact in a review holds it out of public view and opens a masked report', async ({
    client,
    assert,
  }) => {
    const { scenario, establishment, author } = await setup('am-hold')
    const review = await writeReview(
      client,
      scenario,
      establishment,
      author,
      'Me chama no joao.silva@gmail.com que te passo desconto'
    )

    assert.equal(review.status, 'hidden')
    assert.equal(await publicReviewCount(client, scenario, establishment), 0)

    const report = await automaticReportFor(scenario.tenant.id, 'review', review.id)
    assert.isNotNull(report)
    assert.equal(report!.automatic_rule, 'contact')
    assert.isTrue(report!.holds_content)
    assert.isNull(report!.reporter_id)
    assert.equal(report!.reason, 'inappropriate')
    assert.equal(report!.automatic_evidence, 'e-mail j***@gmail.com')
    assert.notInclude(report!.details ?? '', 'joao.silva@')
  })

  test('a link publishes and is flagged, not held', async ({ client, assert }) => {
    const { scenario, establishment, author } = await setup('am-flag')
    const review = await writeReview(
      client,
      scenario,
      establishment,
      author,
      'Achei o cardápio em cafepromo.com.br, muito bom'
    )

    assert.equal(review.status, 'published')
    assert.equal(await publicReviewCount(client, scenario, establishment), 1)
    const report = await automaticReportFor(scenario.tenant.id, 'review', review.id)
    assert.equal(report!.automatic_rule, 'link')
    assert.isFalse(report!.holds_content)
  })

  test('dismissing the rule report releases what it held', async ({ client, assert }) => {
    const { scenario, establishment, author, moderator } = await setup('am-release')
    const review = await writeReview(client, scenario, establishment, author, 'liga 98765-4321')
    const report = await automaticReportFor(scenario.tenant.id, 'review', review.id)

    const dismissed = await client
      .post(`/api/v1/admin/content-reports/${report!.id}/resolve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ status: 'dismissed', resolution_action: 'no_violation' })
    dismissed.assertStatus(200)

    await review.refresh()
    assert.equal(review.status, 'published')
    assert.equal(await publicReviewCount(client, scenario, establishment), 1)
  })

  test('resolving with content_hidden keeps it hidden', async ({ client, assert }) => {
    const { scenario, establishment, author, moderator } = await setup('am-keep')
    const review = await writeReview(client, scenario, establishment, author, 'liga 98765-4321')
    const report = await automaticReportFor(scenario.tenant.id, 'review', review.id)

    await client
      .post(`/api/v1/admin/content-reports/${report!.id}/resolve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ status: 'resolved', resolution_action: 'content_hidden' })

    await review.refresh()
    assert.equal(review.status, 'hidden')
  })

  test('dismissing the rule does not undo a person hiding it on the merits', async ({
    client,
    assert,
  }) => {
    const { scenario, establishment, author, moderator } = await setup('am-merits')
    const reporter = await createUser({ prefix: 'am-merits-reporter', tenant: scenario.tenant })
    const review = await writeReview(client, scenario, establishment, author, 'liga 98765-4321')
    const automatic = await automaticReportFor(scenario.tenant.id, 'review', review.id)
    const headers = tenantHeader(scenario.tenant.id)

    const personal = await client
      .post('/api/v1/content-reports')
      .headers(headers)
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: review.id, reason: 'offensive' })
    await client
      .post(`/api/v1/admin/content-reports/${personal.body().id}/resolve`)
      .headers(headers)
      .loginAs(moderator)
      .json({ status: 'resolved', resolution_action: 'content_hidden' })

    await client
      .post(`/api/v1/admin/content-reports/${automatic!.id}/resolve`)
      .headers(headers)
      .loginAs(moderator)
      .json({ status: 'dismissed' })

    await review.refresh()
    assert.equal(review.status, 'hidden')
  })

  test('editing held text again updates the same report instead of stacking', async ({
    client,
    assert,
  }) => {
    const { scenario, establishment, author } = await setup('am-edit')
    const review = await writeReview(client, scenario, establishment, author, 'liga 98765-4321')
    // The edit window allows it, the interval needs to have passed.
    review.edited_at = DateTime.utc().minus({ days: 1 })
    await review.save()
    // A person hid it? No — it is held; editing held text is not re-assessed,
    // since it is not public. Put it back to published to exercise the edit.
    review.status = 'published'
    await review.save()

    const edited = await client
      .put(`/api/v1/me/reviews/${review.id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(author)
      .json({ comment: 'agora no whats (43) 99999-1234' })
    edited.assertStatus(200)

    const reports = await ContentReport.query()
      .where('tenant_id', scenario.tenant.id)
      .where('target_type', 'review')
      .where('target_id', review.id)
      .where('origin', 'automatic')
    assert.lengthOf(reports, 1)
    assert.equal(reports[0].automatic_evidence, 'telefone terminado em 34')
    await review.refresh()
    assert.equal(review.status, 'hidden')
  })

  test('a contact in a partner reply holds the reply', async ({ client, assert }) => {
    const { scenario, establishment, author } = await setup('am-reply')
    const review = await writeReview(client, scenario, establishment, author, 'Gostei bastante')

    const replied = await client
      .post(`/api/v1/portal/reviews/${review.id}/replies`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ comment: 'Obrigado! Reservas pelo 43 3333-4444.' })
    replied.assertStatus(201)
    assert.equal(replied.body().status, 'hidden')

    const report = await automaticReportFor(scenario.tenant.id, 'reply', replied.body().id)
    assert.equal(report!.automatic_rule, 'contact')
  })

  test('held partner content waits in the approval queue and a dismissal publishes it', async ({
    client,
    assert,
  }) => {
    const { scenario, establishment, moderator } = await setup('am-content')
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Degustação',
        description: 'Inscrições pelo contato@cafe.com.br',
      })
    const submitted = await client
      .post(`/api/v1/portal/content/experiences/${created.body().id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)
    // Experiences need no approval by default: only the rule is holding it.
    submitted.assertBodyContains({ status: 'pending_review' })

    const report = await automaticReportFor(scenario.tenant.id, 'experience', created.body().id)
    assert.isTrue(report!.holds_content)

    await client
      .post(`/api/v1/admin/content-reports/${report!.id}/resolve`)
      .headers(headers)
      .loginAs(moderator)
      .json({ status: 'dismissed' })

    const listed = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/experiences`)
      .headers(publicHeaders(scenario))
    assert.lengthOf(listed.body().data, 1)
  })

  test('dismissing a rule is not approving content the policy says must be approved', async ({
    client,
    assert,
  }) => {
    const { scenario, establishment, moderator } = await setup('am-event')
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/events')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Sarau',
        description: 'Ingressos pelo (43) 99999-1234',
        starts_at: DateTime.utc().plus({ days: 3 }).toISO(),
        ends_at: DateTime.utc().plus({ days: 3, hours: 4 }).toISO(),
      })
    await client
      .post(`/api/v1/portal/content/events/${created.body().id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)
    const report = await automaticReportFor(scenario.tenant.id, 'event', created.body().id)

    await client
      .post(`/api/v1/admin/content-reports/${report!.id}/resolve`)
      .headers(headers)
      .loginAs(moderator)
      .json({ status: 'dismissed' })

    const row = await db.from('establishment_events').where('id', created.body().id).first()
    assert.equal(row.status, 'pending_review')
  })

  test('rules belong to their operation', async ({ client, assert }) => {
    const alpha = await setup('am-alpha')
    const beta = await setup('am-beta')
    const admin = await createUser({
      prefix: 'am-admin',
      tenant: alpha.scenario.tenant,
      globalRole: IRoles.Slugs.ADMIN,
    })

    const updated = await client
      .put('/api/v1/admin/moderation-rules')
      .headers(tenantHeader(alpha.scenario.tenant.id))
      .loginAs(admin)
      .json({ blocked_terms: [' golpe ', 'golpe', 'picareta'] })
    updated.assertStatus(200)
    assert.deepEqual(updated.body().blocked_terms, ['golpe', 'picareta'])

    const inAlpha = await writeReview(
      client,
      alpha.scenario,
      alpha.establishment,
      alpha.author,
      'Isso é um GOLPE'
    )
    const inBeta = await writeReview(
      client,
      beta.scenario,
      beta.establishment,
      beta.author,
      'Isso é um GOLPE'
    )

    assert.equal(inAlpha.status, 'hidden')
    assert.equal(inBeta.status, 'published')
    assert.isNull(await automaticReportFor(beta.scenario.tenant.id, 'review', inBeta.id))
  })

  test('a detector turned off does nothing', async ({ client, assert }) => {
    const { scenario, establishment, author } = await setup('am-off')
    const admin = await createUser({
      prefix: 'am-off-admin',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.ADMIN,
    })
    await client
      .put('/api/v1/admin/moderation-rules')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(admin)
      .json({ contact_mode: 'off' })

    const review = await writeReview(client, scenario, establishment, author, 'liga 98765-4321')
    assert.equal(review.status, 'published')
    assert.isNull(await automaticReportFor(scenario.tenant.id, 'review', review.id))
  })

  test('only an admin reads or changes the rules; defaults are provisional', async ({ client }) => {
    const { scenario, moderator } = await setup('am-guard')
    const admin = await createUser({
      prefix: 'am-guard-admin',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.ADMIN,
    })
    const headers = tenantHeader(scenario.tenant.id)

    const read = await client.get('/api/v1/admin/moderation-rules').headers(headers).loginAs(admin)
    read.assertStatus(200)
    read.assertBodyContains({
      link_mode: 'flag',
      contact_mode: 'hold',
      payment_data_mode: 'hold',
      blocked_term_mode: 'hold',
      blocked_terms: [],
    })

    const byModerator = await client
      .put('/api/v1/admin/moderation-rules')
      .headers(headers)
      .loginAs(moderator)
      .json({ link_mode: 'off' })
    byModerator.assertStatus(403)

    const byPartner = await client
      .get('/api/v1/admin/moderation-rules')
      .headers(headers)
      .loginAs(scenario.owner)
    byPartner.assertStatus(403)

    const invalid = await client
      .put('/api/v1/admin/moderation-rules')
      .headers(headers)
      .loginAs(admin)
      .json({ link_mode: 'delete' })
    invalid.assertStatus(422)
  })

  test('the report queue says a rule opened the case and which one', async ({ client, assert }) => {
    const { scenario, establishment, author, moderator } = await setup('am-queue')
    await writeReview(client, scenario, establishment, author, 'cartão 4111 1111 1111 1111')

    const queue = await client
      .get('/backoffice/reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
    queue.assertStatus(200)
    assert.include(queue.text(), '"origin":"automatic"')
    assert.include(queue.text(), '"automatic_rule":"payment_data"')
    assert.include(queue.text(), 'cartão terminado em 1111')
    assert.notInclude(queue.text(), '4111 1111 1111 1111')
  })
})
