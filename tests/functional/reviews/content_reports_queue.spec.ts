import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import EstablishmentReview from '#modules/reviews/models/establishment_review'
import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

async function reportedReview(scenario: EstablishmentScenario, comment: string) {
  const establishment = await createPublishedEstablishment(scenario)
  const author = await createUser({ prefix: 'queue-author', tenant: scenario.tenant })
  const reporter = await createUser({ prefix: 'queue-reporter', tenant: scenario.tenant })
  const moderator = await createUser({
    prefix: 'queue-moderator',
    tenant: scenario.tenant,
    globalRole: IRoles.Slugs.MODERATOR,
  })

  const review = await EstablishmentReview.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    user_id: author.id,
    rating: 1,
    comment,
    status: 'published',
    photos_count: 0,
    videos_count: 0,
  })

  return { establishment, author, reporter, moderator, review }
}

test.group('Content report queue (backoffice)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('shows the reported text, not only the protocol', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('queue-text')
    const comment = 'Texto denunciado que o moderador precisa conseguir ler.'
    const { reporter, moderator, review, author } = await reportedReview(scenario, comment)

    const filed = await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({
        target_type: 'review',
        target_id: review.id,
        reason: 'offensive',
        details: 'O texto ofende.',
      })
    filed.assertStatus(201)

    const queue = await client
      .get('/backoffice/reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)

    queue.assertStatus(200)
    assert.include(queue.text(), 'backoffice/reports/index')
    // The whole reason this screen resolves the target: a moderator asked to
    // judge "offensive" from an identifier is being asked to guess.
    assert.include(queue.text(), comment)
    assert.include(queue.text(), author.full_name)
    assert.include(queue.text(), filed.body().protocol_number)

    assert.equal(queue.header('cache-control'), 'private, no-store')
    assert.equal(queue.header('x-robots-tag'), 'noindex, nofollow')
  })

  test('never sends the reporter email to the page', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('queue-privacy')
    const { reporter, moderator, review } = await reportedReview(
      scenario,
      'Texto qualquer para a fila.'
    )

    await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: review.id, reason: 'spam' })

    const queue = await client
      .get('/backoffice/reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)

    queue.assertStatus(200)
    // Moderation needs a name to talk about a case; it does not need a way to
    // contact the person who filed it, and the page is one `view-source` away
    // from anyone who reaches it.
    assert.notInclude(queue.text(), reporter.email)
    assert.notInclude(queue.text(), 'reporter_ip_hash')
    assert.notInclude(queue.text(), 'reporter_token_hash')
  })

  test('a partner cannot open the queue of the operation it sells in', async ({ client }) => {
    const scenario = await createEstablishmentScenario('queue-denied')
    const { reporter, review } = await reportedReview(scenario, 'Texto para negar acesso.')

    await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: review.id, reason: 'spam' })

    const asOwner = await client
      .get('/backoffice/reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    asOwner.assertStatus(403)

    const asReporter = await client
      .get('/backoffice/reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
    asReporter.assertStatus(403)
  })

  test('resolving with content_hidden takes the review off the public catalogue', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('queue-hide')
    const { reporter, moderator, review, establishment } = await reportedReview(
      scenario,
      'Texto que sai do ar depois da decisão.'
    )

    const filed = await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: review.id, reason: 'offensive' })

    const before = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
      .headers({
        'host': `${scenario.tenant.slug}.experimente.test`,
        'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
      })
    assert.lengthOf(before.body().data, 1)

    const decision = await client
      .post(`/backoffice/reports/${filed.body().id}/resolve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      // The queue is a web route, so shield guards it. Inertia sends the token
      // from the cookie; a test that skipped it would be exercising a door the
      // browser cannot open.
      .withCsrfToken()
      .redirects(0)
      .json({
        status: 'resolved',
        resolution_action: 'content_hidden',
        resolution_notes: 'Ofensa confirmada.',
      })
    assert.oneOf(decision.status(), [200, 302])

    await review.refresh()
    assert.equal(review.status, 'hidden')

    const after = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
      .headers({
        'host': `${scenario.tenant.slug}.experimente.test`,
        'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
      })
    assert.lengthOf(after.body().data, 0)
  })

  test('dismissing records the outcome and leaves the content alone', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('queue-dismiss')
    const { reporter, moderator, review } = await reportedReview(
      scenario,
      'Texto que permanece publicado.'
    )

    const filed = await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: review.id, reason: 'spam' })

    await client
      .post(`/backoffice/reports/${filed.body().id}/resolve`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .withCsrfToken()
      .redirects(0)
      .json({ status: 'dismissed', resolution_action: 'no_violation' })

    await review.refresh()
    assert.equal(review.status, 'published')

    const settled = await client
      .get('/backoffice/reports?status=dismissed')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
    settled.assertStatus(200)
    assert.include(settled.text(), filed.body().protocol_number)
    assert.include(settled.text(), 'no_violation')
  })

  test('a case whose content was deleted still opens', async ({ client, assert }) => {
    const scenario = await createEstablishmentScenario('queue-gone')
    const { reporter, moderator, review } = await reportedReview(
      scenario,
      'Texto que será apagado depois da denúncia.'
    )

    const filed = await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: review.id, reason: 'harassment' })

    await review.delete()

    const queue = await client
      .get('/backoffice/reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)

    // The protocol outlives the content, and the operation can be asked about
    // it: a queue that hid the case would leave that question unanswerable.
    queue.assertStatus(200)
    assert.include(queue.text(), filed.body().protocol_number)
    assert.include(queue.text(), '"exists":false')
  })
})
