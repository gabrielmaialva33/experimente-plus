import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import IRoles from '#modules/roles/interfaces/role_interface'
import Establishment from '#modules/establishments/models/establishment'
import PartnerContentPolicy from '#modules/partner_content/models/partner_content_policy'
import {
  createEstablishmentScenario,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })
const publicHeaders = (scenario: EstablishmentScenario) => ({
  'host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-for': `198.51.100.${(scenario.tenant.id % 250) + 1}`,
})

async function createUnit(scenario: EstablishmentScenario): Promise<Establishment> {
  return Establishment.create({
    tenant_id: scenario.tenant.id,
    organization_id: scenario.organization.id,
    lifecycle_status: 'active',
    business_status: 'open',
    created_by: scenario.owner.id,
  })
}

const future = (hours: number) => DateTime.utc().plus({ hours }).toISO()

test.group('Partner content', () => {
  test('publishes without a queue when the operation does not require approval', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pc-direct')
    const establishment = await createUnit(scenario)

    const created = await client
      .post('/api/v1/portal/content/experiences')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Degustação de cafés especiais',
        description: 'Uma hora percorrendo métodos de extração.',
      })

    created.assertStatus(201)
    created.assertBodyContains({ status: 'draft', title: 'Degustação de cafés especiais' })

    const published = await client
      .post(`/api/v1/portal/content/experiences/${created.body().id}/submit`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)

    published.assertStatus(200)
    published.assertBodyContains({ status: 'published' })
    assert.isNotNull(published.body().published_snapshot)
    assert.equal(published.body().published_snapshot.title, 'Degustação de cafés especiais')
  })

  test('holds an event for approval, because that is this operation default', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pc-queue')
    const establishment = await createUnit(scenario)

    const created = await client
      .post('/api/v1/portal/content/events')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Noite de jazz',
        starts_at: future(48),
        ends_at: future(52),
      })

    created.assertStatus(201)

    const submitted = await client
      .post(`/api/v1/portal/content/events/${created.body().id}/submit`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)

    submitted.assertStatus(200)
    submitted.assertBodyContains({ status: 'pending_review' })
    assert.isNull(submitted.body().published_snapshot)

    // Nothing is public while it waits.
    const beforeApproval = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/events`)
      .headers(publicHeaders(scenario))
    beforeApproval.assertStatus(200)
    assert.lengthOf(beforeApproval.body().data, 0)

    const moderator = await createUser({
      prefix: 'pc-moderator',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })

    const approved = await client
      .post(`/api/v1/admin/content/events/${created.body().id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)

    approved.assertStatus(200)
    approved.assertBodyContains({ status: 'published' })

    const afterApproval = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/events`)
      .headers(publicHeaders(scenario))
    assert.lengthOf(afterApproval.body().data, 1)
    assert.equal(afterApproval.body().data[0].title, 'Noite de jazz')
  })

  /**
   * ADR-0028 §4, and the reason the snapshot exists: correcting a typo must not
   * take a published event off the air while a moderator gets to it.
   */
  test('keeps the approved version public while an edit waits for approval', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pc-edit')
    const establishment = await createUnit(scenario)
    const moderator = await createUser({
      prefix: 'pc-edit-mod',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })

    const created = await client
      .post('/api/v1/portal/content/events')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Feira de vinilis',
        starts_at: future(72),
        ends_at: future(76),
      })

    const id = created.body().id
    await client
      .post(`/api/v1/portal/content/events/${id}/submit`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    await client
      .post(`/api/v1/admin/content/events/${id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)

    const edited = await client
      .put(`/api/v1/portal/content/events/${id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ title: 'Feira de vinis' })

    edited.assertStatus(200)
    edited.assertBodyContains({ status: 'pending_review', title: 'Feira de vinis' })

    // The public still reads what was approved — the typo and all.
    const stillPublic = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/events`)
      .headers(publicHeaders(scenario))
    assert.lengthOf(stillPublic.body().data, 1)
    assert.equal(stillPublic.body().data[0].published_snapshot.title, 'Feira de vinilis')

    await client
      .post(`/api/v1/admin/content/events/${id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)

    const corrected = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/events`)
      .headers(publicHeaders(scenario))
    assert.equal(corrected.body().data[0].published_snapshot.title, 'Feira de vinis')
  })

  test('refusing an edit restores the version that was already approved', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pc-reject')
    const establishment = await createUnit(scenario)
    const moderator = await createUser({
      prefix: 'pc-reject-mod',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })

    const created = await client
      .post('/api/v1/portal/content/events')
      .headers(tenantHeader(scenario.tenant.id))
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
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    await client
      .post(`/api/v1/admin/content/events/${id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
    await client
      .put(`/api/v1/portal/content/events/${id}`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ title: 'Sarau com entrada franca' })

    const rejected = await client
      .post(`/api/v1/admin/content/events/${id}/reject`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)

    rejected.assertStatus(200)
    rejected.assertBodyContains({ status: 'published' })

    const still = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/events`)
      .headers(publicHeaders(scenario))
    assert.equal(still.body().data[0].published_snapshot.title, 'Sarau')
  })

  test('an event leaves discovery by its own window, without anyone archiving it', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pc-window')
    const establishment = await createUnit(scenario)

    const policy = await PartnerContentPolicy.create({
      tenant_id: scenario.tenant.id,
      require_event_approval: false,
    })
    assert.isFalse(policy.require_event_approval)

    const past = await client
      .post('/api/v1/portal/content/events')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Show que já aconteceu',
        starts_at: DateTime.utc().minus({ days: 3 }).toISO(),
        ends_at: DateTime.utc().minus({ days: 2 }).toISO(),
      })

    await client
      .post(`/api/v1/portal/content/events/${past.body().id}/submit`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)

    const upcoming = await client
      .post('/api/v1/portal/content/events')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Show que ainda vem',
        starts_at: future(24),
        ends_at: future(28),
      })

    await client
      .post(`/api/v1/portal/content/events/${upcoming.body().id}/submit`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)

    const listing = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/events`)
      .headers(publicHeaders(scenario))

    assert.lengthOf(listing.body().data, 1)
    assert.equal(listing.body().data[0].title, 'Show que ainda vem')
  })

  test('withdrawing content archives it and never deletes the row', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('pc-archive')
    const establishment = await createUnit(scenario)

    const created = await client
      .post('/api/v1/portal/content/showcase-items')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Prato do dia',
        informational_price_cents: 4500,
      })

    const id = created.body().id
    await client
      .post(`/api/v1/portal/content/showcase-items/${id}/submit`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)

    const archived = await client
      .post(`/api/v1/portal/content/showcase-items/${id}/archive`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)

    archived.assertStatus(200)
    archived.assertBodyContains({ status: 'archived' })
    assert.isNotNull(archived.body().archived_at)
    assert.equal(archived.body().archived_by, scenario.owner.id)

    const gone = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/showcase-items`)
      .headers(publicHeaders(scenario))
    assert.lengthOf(gone.body().data, 0)

    // The row is still there: withdrawal is not destruction.
    const { default: EstablishmentShowcaseItem } =
      await import('#modules/partner_content/models/establishment_showcase_item')
    const row = await EstablishmentShowcaseItem.find(id)
    assert.isNotNull(row)
    assert.equal(row!.status, 'archived')
  })

  test('a member of another operation cannot write content for this one', async ({ client }) => {
    const scenario = await createEstablishmentScenario('pc-owner')
    const establishment = await createUnit(scenario)
    const stranger = await createUser({
      prefix: 'pc-stranger',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })

    const response = await client
      .post('/api/v1/portal/content/experiences')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(stranger)
      .json({ establishment_id: establishment.id, title: 'Tentativa' })

    // 404, not 403: the repository does not confirm that an organization exists
    // to someone who is not in it, and this route inherits that decision.
    response.assertStatus(404)
  })

  test('only a moderator approves, and a partner cannot approve their own', async ({ client }) => {
    const scenario = await createEstablishmentScenario('pc-approve')
    const establishment = await createUnit(scenario)

    const created = await client
      .post('/api/v1/portal/content/events')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Autoaprovação',
        starts_at: future(24),
        ends_at: future(26),
      })

    await client
      .post(`/api/v1/portal/content/events/${created.body().id}/submit`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)

    const response = await client
      .post(`/api/v1/admin/content/events/${created.body().id}/approve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)

    response.assertStatus(403)
  })

  test('the reviews route still answers, and an unknown kind does not', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pc-routing')
    const establishment = await createUnit(scenario)

    const reviews = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
      .headers(publicHeaders(scenario))
    reviews.assertStatus(200)
    assert.property(reviews.body(), 'meta')

    const unknown = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/banners`)
      .headers(publicHeaders(scenario))
    assert.notEqual(unknown.status(), 200)
  })

  test('the approval requirement is tenant policy an administrator can change', async ({
    client,
  }) => {
    const scenario = await createEstablishmentScenario('pc-policy')
    const admin = await createUser({
      prefix: 'pc-policy-admin',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.ADMIN,
    })

    const initial = await client
      .get('/api/v1/admin/partner-content-policy')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(admin)

    initial.assertStatus(200)
    initial.assertBodyContains({
      require_event_approval: true,
      require_experience_approval: false,
      max_media_per_content: 6,
    })

    const updated = await client
      .put('/api/v1/admin/partner-content-policy')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(admin)
      .json({ require_event_approval: false, min_event_notice_minutes: 120 })

    updated.assertStatus(200)
    updated.assertBodyContains({ require_event_approval: false, min_event_notice_minutes: 120 })

    const denied = await client
      .put('/api/v1/admin/partner-content-policy')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({ require_event_approval: true })

    denied.assertStatus(403)
  })

  test('the minimum notice is enforced when publishing, not while drafting', async ({ client }) => {
    const scenario = await createEstablishmentScenario('pc-notice')
    const establishment = await createUnit(scenario)
    await PartnerContentPolicy.create({
      tenant_id: scenario.tenant.id,
      require_event_approval: false,
      min_event_notice_minutes: 240,
    })

    const created = await client
      .post('/api/v1/portal/content/events')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
      .json({
        establishment_id: establishment.id,
        title: 'Evento em cima da hora',
        starts_at: future(1),
        ends_at: future(3),
      })

    // Drafting is allowed: the rule is about becoming public.
    created.assertStatus(201)

    const submitted = await client
      .post(`/api/v1/portal/content/events/${created.body().id}/submit`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)

    submitted.assertStatus(400)
  })
})
