import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import PartnerContentPolicy from '#modules/partner_content/models/partner_content_policy'
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
const future = (hours: number) => DateTime.utc().plus({ hours }).toISO()

async function moderatorIn(scenario: EstablishmentScenario) {
  return createUser({
    prefix: 'pch-moderator',
    tenant: scenario.tenant,
    globalRole: IRoles.Slugs.MODERATOR,
  })
}

test.group('Partner content history and administrative edit (ADR-0028 §4)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  // The limiter is in memory and shared by the whole test process, and the
  // public reads here count against the guest budget of 127.0.0.1. Clearing it
  // around each test keeps this suite from spending the next suite's budget.
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  test('every act is recorded with the person who did it', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('pch-acts')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/events')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Noite de jazz',
        starts_at: future(48),
        ends_at: future(52),
      })
    const id = created.body().id

    await client
      .put(`/api/v1/portal/content/events/${id}`)
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ title: 'Noite de jazz ao vivo' })
    await client
      .post(`/api/v1/portal/content/events/${id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)
    await client
      .post(`/api/v1/admin/content/events/${id}/reject`)
      .headers(headers)
      .loginAs(moderator)
    await client
      .post(`/api/v1/portal/content/events/${id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)
    await client
      .post(`/api/v1/admin/content/events/${id}/approve`)
      .headers(headers)
      .loginAs(moderator)
    await client
      .post(`/api/v1/admin/content/events/${id}/archive`)
      .headers(headers)
      .loginAs(moderator)

    const history = await client
      .get(`/api/v1/admin/content/events/${id}/history`)
      .headers(headers)
      .loginAs(moderator)
    history.assertStatus(200)

    const acts = [...history.body().data]
      .reverse()
      .map((event: any) => [event.action, event.actor.id, event.from_status, event.to_status])
    assert.deepEqual(acts, [
      ['created', scenario.owner.id, null, 'draft'],
      ['updated', scenario.owner.id, 'draft', 'draft'],
      ['submitted', scenario.owner.id, 'draft', 'pending_review'],
      ['rejected', moderator.id, 'pending_review', 'draft'],
      ['submitted', scenario.owner.id, 'draft', 'pending_review'],
      ['approved', moderator.id, 'pending_review', 'published'],
      ['archived', moderator.id, 'published', 'archived'],
    ])

    // Only the field that moved, as before and after — never the row.
    const update = history.body().data.find((event: any) => event.action === 'updated')
    assert.deepEqual(update.changes, {
      title: { from: 'Noite de jazz', to: 'Noite de jazz ao vivo' },
    })
    const serialised = JSON.stringify(history.body())
    assert.notInclude(serialised, 'tenant_id')
    assert.notInclude(serialised, 'published_snapshot')
    assert.notInclude(serialised, scenario.owner.email)
  })

  test('the history cannot be rewritten', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('pch-immutable')
    const establishment = await createPublishedEstablishment(scenario)

    await client
      .post('/api/v1/portal/content/experiences')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Oficina de café' })

    // Each attempt runs in its own savepoint: a refused statement aborts the
    // surrounding transaction, and the second attempt must be refused by the
    // trigger, not by the aftermath of the first.
    await assert.rejects(
      () =>
        db.transaction((trx) =>
          trx.from('partner_content_events').where('tenant_id', scenario.tenant.id).delete()
        ),
      /append-only/
    )
    await assert.rejects(
      () =>
        db.transaction((trx) =>
          trx
            .from('partner_content_events')
            .where('tenant_id', scenario.tenant.id)
            .update({ action: 'approved' })
        ),
      /append-only/
    )
  })

  test('an administrator correcting published content changes what the public reads at once', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pch-published')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Degustaçao de cafés' })
    const id = created.body().id
    const published = await client
      .post(`/api/v1/portal/content/experiences/${id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)
    published.assertBodyContains({ status: 'published' })
    const publishedAt = published.body().published_at

    const edited = await client
      .put(`/api/v1/admin/content/experiences/${id}`)
      .headers(headers)
      .loginAs(moderator)
      .json({ title: 'Degustação de cafés' })
    edited.assertStatus(200)
    edited.assertBodyContains({ status: 'published' })
    assert.equal(edited.body().published_snapshot.title, 'Degustação de cafés')
    // A typo fix must not push an old item to the top of "Novidades".
    assert.equal(Date.parse(edited.body().published_at), Date.parse(publishedAt))

    const visible = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/experiences`)
      .headers(publicHeaders(scenario))
    assert.equal(visible.body().data[0].title, 'Degustação de cafés')

    const history = await client
      .get(`/api/v1/admin/content/experiences/${id}/history`)
      .headers(headers)
      .loginAs(moderator)
    const edit = history.body().data[0]
    assert.equal(edit.action, 'admin_edited')
    assert.equal(edit.actor.id, moderator.id)
    assert.deepEqual(edit.metadata, { republished: true })
  })

  test('an administrator correcting a pending item does not publish it', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pch-pending')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/events')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Sarau',
        starts_at: future(48),
        ends_at: future(52),
      })
    const id = created.body().id
    await client
      .post(`/api/v1/portal/content/events/${id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)

    const edited = await client
      .put(`/api/v1/admin/content/events/${id}`)
      .headers(headers)
      .loginAs(moderator)
      .json({ title: 'Sarau no quintal' })
    edited.assertStatus(200)
    edited.assertBodyContains({ status: 'pending_review', title: 'Sarau no quintal' })
    assert.isNull(edited.body().published_snapshot)

    const nothingPublic = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/events`)
      .headers(publicHeaders(scenario))
    assert.lengthOf(nothingPublic.body().data, 0)
  })

  test('moving a published event applies the minimum notice; other corrections do not', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pch-notice')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/events')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Feira',
        starts_at: future(48),
        ends_at: future(52),
      })
    const id = created.body().id
    await client
      .post(`/api/v1/portal/content/events/${id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)
    await client
      .post(`/api/v1/admin/content/events/${id}/approve`)
      .headers(headers)
      .loginAs(moderator)

    await PartnerContentPolicy.query()
      .where('tenant_id', scenario.tenant.id)
      .update({ min_event_notice_minutes: 120 })

    const tooSoon = await client
      .put(`/api/v1/admin/content/events/${id}`)
      .headers(headers)
      .loginAs(moderator)
      .json({ starts_at: future(1), ends_at: future(3) })
    tooSoon.assertStatus(400)

    const titleOnly = await client
      .put(`/api/v1/admin/content/events/${id}`)
      .headers(headers)
      .loginAs(moderator)
      .json({ title: 'Feira de vinis' })
    titleOnly.assertStatus(200)
    assert.equal(titleOnly.body().published_snapshot.title, 'Feira de vinis')
  })

  test('archived content is not edited, and an empty correction records nothing', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pch-archived')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Oficina' })
    const id = created.body().id

    const unchanged = await client
      .put(`/api/v1/admin/content/experiences/${id}`)
      .headers(headers)
      .loginAs(moderator)
      .json({ title: 'Oficina' })
    unchanged.assertStatus(200)
    const events = await db
      .from('partner_content_events')
      .where('content_kind', 'experience')
      .where('content_id', id)
    assert.lengthOf(events, 1)

    await client
      .post(`/api/v1/admin/content/experiences/${id}/archive`)
      .headers(headers)
      .loginAs(moderator)
    const refused = await client
      .put(`/api/v1/admin/content/experiences/${id}`)
      .headers(headers)
      .loginAs(moderator)
      .json({ title: 'Outra' })
    refused.assertStatus(400)
  })

  test('a partner cannot use the administrative edit nor read the history', async ({ client }) => {
    const scenario = await createEstablishmentScenario('pch-partner')
    const establishment = await createPublishedEstablishment(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Oficina' })
    const id = created.body().id

    const edit = await client
      .put(`/api/v1/admin/content/experiences/${id}`)
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ title: 'Publicada sem fila' })
    edit.assertStatus(403)

    const history = await client
      .get(`/api/v1/admin/content/experiences/${id}/history`)
      .headers(headers)
      .loginAs(scenario.owner)
    history.assertStatus(403)

    const anonymous = await client.get(`/api/v1/admin/content/experiences/${id}/history`)
    anonymous.assertStatus(401)
  })

  test('content of another operation is absent to the moderator of this one', async ({
    client,
  }) => {
    const own = await createEstablishmentScenario('pch-own')
    const foreign = await createEstablishmentScenario('pch-foreign')
    const foreignEstablishment = await createPublishedEstablishment(foreign)
    const moderator = await moderatorIn(own)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(tenantHeader(foreign.tenant.id))
      .loginAs(foreign.owner)
      .json({ establishment_id: foreignEstablishment.id, title: 'Alheia' })
    const id = created.body().id

    const edit = await client
      .put(`/api/v1/admin/content/experiences/${id}`)
      .headers(tenantHeader(own.tenant.id))
      .loginAs(moderator)
      .json({ title: 'Tomada' })
    edit.assertStatus(404)

    const history = await client
      .get(`/api/v1/admin/content/experiences/${id}/history`)
      .headers(tenantHeader(own.tenant.id))
      .loginAs(moderator)
    history.assertStatus(404)
  })

  test('the public never reads the history', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('pch-public')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Visível' })
    await client
      .post(`/api/v1/portal/content/experiences/${created.body().id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)
    await client
      .put(`/api/v1/admin/content/experiences/${created.body().id}`)
      .headers(headers)
      .loginAs(moderator)
      .json({ title: 'Visível e corrigida' })

    const listed = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/experiences`)
      .headers(publicHeaders(scenario))
    const body = JSON.stringify(listed.body())
    assert.notMatch(body, /admin_edited|history|actor|changes/)
    assert.notInclude(body, moderator.full_name)
  })

  test('hiding reported content through the report queue leaves an archive event', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pch-report')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await moderatorIn(scenario)
    const reporter = await createUser({ prefix: 'pch-reporter', tenant: scenario.tenant })
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Propaganda' })
    const id = created.body().id
    await client
      .post(`/api/v1/portal/content/experiences/${id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)

    const report = await client
      .post('/api/v1/content-reports')
      .headers(headers)
      .loginAs(reporter)
      .json({ target_type: 'experience', target_id: id, reason: 'spam' })
    report.assertStatus(201)

    await client
      .post(`/api/v1/admin/content-reports/${report.body().id}/resolve`)
      .headers(headers)
      .loginAs(moderator)
      .json({ status: 'resolved', resolution_action: 'content_hidden' })

    const history = await client
      .get(`/api/v1/admin/content/experiences/${id}/history`)
      .headers(headers)
      .loginAs(moderator)
    const archived = history.body().data[0]
    assert.equal(archived.action, 'archived')
    assert.equal(archived.actor.id, moderator.id)
    assert.deepEqual(archived.metadata, { as_moderator: true })
  })

  test('the backoffice edits through its own page', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('pch-web')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Rascunho' })
    const id = created.body().id

    const edited = await client
      .put(`/backoffice/content/experiences/${id}`)
      .headers(headers)
      .loginAs(moderator)
      .withCsrfToken()
      .redirects(0)
      .json({ title: 'Rascunho corrigido' })
    assert.oneOf(edited.status(), [200, 302])

    const row = await db.from('establishment_experiences').where('id', id).first()
    assert.equal(row.title, 'Rascunho corrigido')
    assert.equal(row.status, 'draft')
  })
})
