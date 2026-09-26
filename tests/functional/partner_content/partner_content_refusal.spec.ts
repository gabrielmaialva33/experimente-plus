import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import IRoles from '#modules/roles/interfaces/role_interface'
import PartnerContentPolicy from '#modules/partner_content/models/partner_content_policy'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })
const future = (hours: number) => DateTime.utc().plus({ hours }).toISO()

function parseInertiaPage(response: { text(): string }) {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('The response does not contain an Inertia page payload')
  return JSON.parse(match[1]) as { component: string; props: Record<string, unknown> }
}

async function moderatorIn(scenario: EstablishmentScenario) {
  return createUser({
    prefix: `${scenario.tenant.slug}-mod`,
    tenant: scenario.tenant,
    globalRole: IRoles.Slugs.MODERATOR,
  })
}

/**
 * A refusal says why — ADR-0028, revision of 27/09/2026.
 *
 * Before it, refusing returned the item to a draft in silence: the partner saw
 * "Rascunho" and could not tell a refusal from an item never sent.
 */
test.group('Partner content refusal', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a refusal needs a reason, and the partner reads it until sending again', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('refusal-draft')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)
    await PartnerContentPolicy.create({
      tenant_id: scenario.tenant.id,
      require_experience_approval: true,
    })

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Oficina de preparo' })
    const id = created.body().id
    await client
      .post(`/api/v1/portal/content/experiences/${id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)

    const silent = await client
      .post(`/api/v1/admin/content/experiences/${id}/reject`)
      .headers(headers)
      .loginAs(moderator)
    silent.assertStatus(422)
    const tooShort = await client
      .post(`/api/v1/admin/content/experiences/${id}/reject`)
      .headers(headers)
      .loginAs(moderator)
      .json({ reason: ' ok ' })
    tooShort.assertStatus(422)
    const unchanged = await db.from('establishment_experiences').where('id', id).first()
    assert.equal(unchanged.status, 'pending_review')

    const refused = await client
      .post(`/api/v1/admin/content/experiences/${id}/reject`)
      .headers(headers)
      .loginAs(moderator)
      .json({ reason: '  A foto mostra outro lugar; use uma do seu espaço.  ' })
    refused.assertStatus(200)
    refused.assertBodyContains({
      status: 'draft',
      rejection_reason: 'A foto mostra outro lugar; use uma do seu espaço.',
    })
    assert.isString(refused.body().rejected_at)

    const listed = await client
      .get('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
    const row = listed.body().data.find((item: { id: number }) => item.id === id)
    assert.equal(row.rejection_reason, 'A foto mostra outro lugar; use uma do seu espaço.')

    const history = await client
      .get(`/api/v1/admin/content/experiences/${id}/history`)
      .headers(headers)
      .loginAs(moderator)
    const refusal = history
      .body()
      .data.find((event: { action: string }) => event.action === 'rejected')
    assert.equal(refusal.metadata.reason, 'A foto mostra outro lugar; use uma do seu espaço.')

    await client
      .post(`/api/v1/portal/content/experiences/${id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)
    const resent = await db.from('establishment_experiences').where('id', id).first()
    assert.equal(resent.status, 'pending_review')
    assert.isNull(resent.rejection_reason)
    assert.isNull(resent.rejected_at)
  })

  test('a refused edit keeps the approved version live and clears once edited again', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('refusal-edit')
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
        starts_at: future(96),
        ends_at: future(100),
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
    await client
      .put(`/api/v1/portal/content/events/${id}`)
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ title: 'Sarau com entrada franca' })

    const refused = await client
      .post(`/api/v1/admin/content/events/${id}/reject`)
      .headers(headers)
      .loginAs(moderator)
      .json({ reason: 'A entrada não é franca segundo o cadastro do lugar.' })
    refused.assertStatus(200)
    refused.assertBodyContains({
      status: 'published',
      rejection_reason: 'A entrada não é franca segundo o cadastro do lugar.',
    })

    await client
      .put(`/api/v1/portal/content/events/${id}`)
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ title: 'Sarau de primavera' })
    const edited = await db.from('establishment_events').where('id', id).first()
    assert.equal(edited.status, 'pending_review')
    assert.isNull(edited.rejection_reason)
  })

  test('the moderation screen refuses with the reason, never silently', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('refusal-web')
    const establishment = await createPublishedEstablishment(scenario)
    const moderator = await moderatorIn(scenario)
    const headers = tenantHeader(scenario.tenant.id)
    await PartnerContentPolicy.create({
      tenant_id: scenario.tenant.id,
      require_experience_approval: true,
    })
    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(headers)
      .loginAs(scenario.owner)
      .json({ establishment_id: establishment.id, title: 'Degustação guiada' })
    const id = created.body().id
    await client
      .post(`/api/v1/portal/content/experiences/${id}/submit`)
      .headers(headers)
      .loginAs(scenario.owner)

    const silent = await client
      .post(`/backoffice/content/experiences/${id}/reject`)
      .headers(headers)
      .loginAs(moderator)
      .withCsrfToken()
      .redirects(0)
      .form({})
    assert.equal(silent.status(), 302)
    const waiting = await db.from('establishment_experiences').where('id', id).first()
    assert.equal(waiting.status, 'pending_review')

    const refused = await client
      .post(`/backoffice/content/experiences/${id}/reject`)
      .headers(headers)
      .loginAs(moderator)
      .withCsrfToken()
      .redirects(0)
      .form({ reason: 'Descreva o que a pessoa vai viver, não só o horário.' })
    assert.equal(refused.status(), 302)
    const row = await db.from('establishment_experiences').where('id', id).first()
    assert.equal(row.status, 'draft')
    assert.equal(row.rejection_reason, 'Descreva o que a pessoa vai viver, não só o horário.')
  })

  test('the partner screen knows which kinds go to analysis before publishing', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('refusal-label')
    await createPublishedEstablishment(scenario)
    await PartnerContentPolicy.create({
      tenant_id: scenario.tenant.id,
      require_experience_approval: true,
      require_event_approval: false,
      require_showcase_item_approval: false,
    })

    const page = await client
      .get('/portal/content')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .accept('html')
    page.assertStatus(200)
    assert.deepEqual(parseInertiaPage(page).props.requires_approval, {
      'experiences': true,
      'events': false,
      'showcase-items': false,
    })
  })
})
