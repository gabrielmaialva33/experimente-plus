import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

test.group("The author's view of a held review", (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a review held by a rule reads as under review, and returns when a person releases it', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('my-held')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'my-held-author', tenant: scenario.tenant })
    const moderator = await createUser({
      prefix: 'my-held-moderator',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })
    const headers = tenantHeader(scenario.tenant.id)

    // A contact in the text: the default contact rule holds it.
    const written = await client.post('/api/v1/me/reviews').headers(headers).loginAs(author).json({
      establishment_id: establishment.id,
      rating: 4,
      comment: 'Ótimo café, falem comigo em cliente.teste@example.com',
    })
    written.assertStatus(201)

    const mine = await client.get('/api/v1/me/reviews').headers(headers).loginAs(author)
    const held = mine.body().data.find((review: any) => review.id === written.body().id)
    assert.equal(held.status, 'hidden')
    assert.isTrue(held.awaiting_moderation)

    // The public listing never says a rule fired.
    const listed = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
      .headers({
        'host': `${scenario.tenant.slug}.experimente.test`,
        'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
      })
    assert.notInclude(JSON.stringify(listed.body()), 'awaiting_moderation')

    const report = await db
      .from('content_reports')
      .where('tenant_id', scenario.tenant.id)
      .where('target_type', 'review')
      .where('target_id', written.body().id)
      .where('origin', 'automatic')
      .first()
    await client
      .post(`/api/v1/admin/content-reports/${report.id}/resolve`)
      .headers(headers)
      .loginAs(moderator)
      .json({ status: 'dismissed', resolution_action: 'no_violation' })

    const after = await client.get('/api/v1/me/reviews').headers(headers).loginAs(author)
    const released = after.body().data.find((review: any) => review.id === written.body().id)
    assert.equal(released.status, 'published')
    assert.isFalse(released.awaiting_moderation)
  })

  test('a review a moderator hid on its merits is not presented as under review', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('my-merits')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'my-merits-author', tenant: scenario.tenant })
    const reporter = await createUser({ prefix: 'my-merits-reporter', tenant: scenario.tenant })
    const moderator = await createUser({
      prefix: 'my-merits-moderator',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })
    const headers = tenantHeader(scenario.tenant.id)

    const written = await client
      .post('/api/v1/me/reviews')
      .headers(headers)
      .loginAs(author)
      .json({ establishment_id: establishment.id, rating: 1, comment: 'Texto sem contato.' })
    const filed = await client
      .post('/api/v1/content-reports')
      .headers(headers)
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: written.body().id, reason: 'offensive' })
    await client
      .post(`/api/v1/admin/content-reports/${filed.body().id}/resolve`)
      .headers(headers)
      .loginAs(moderator)
      .json({ status: 'resolved', resolution_action: 'content_hidden' })

    const mine = await client.get('/api/v1/me/reviews').headers(headers).loginAs(author)
    const hidden = mine.body().data.find((review: any) => review.id === written.body().id)
    assert.equal(hidden.status, 'hidden')
    assert.isFalse(hidden.awaiting_moderation)
  })
})
