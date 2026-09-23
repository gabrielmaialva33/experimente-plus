import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import type Establishment from '#modules/establishments/models/establishment'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
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

async function experience(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  state: 'published' | 'draft' | 'archived' = 'published'
) {
  const published = state !== 'draft'
  return EstablishmentExperience.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    created_by: scenario.owner.id,
    title: 'Oficina de latte art',
    description: 'Texto com propaganda não autorizada.',
    status: state,
    published_snapshot: published
      ? { title: 'Oficina de latte art', description: 'Texto com propaganda não autorizada.' }
      : null,
    published_at: published ? DateTime.utc() : null,
    archived_by: state === 'archived' ? scenario.owner.id : null,
    archived_at: state === 'archived' ? DateTime.utc() : null,
  })
}

test.group('Reporting partner content (ADR-0028, Anexo I item 9)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a published experience is reported, shown to the moderator and archived when hidden', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pcr-hide')
    const establishment = await createPublishedEstablishment(scenario)
    const reporter = await createUser({ prefix: 'pcr-reporter', tenant: scenario.tenant })
    const moderator = await createUser({
      prefix: 'pcr-moderator',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })
    const content = await experience(scenario, establishment)
    const headers = tenantHeader(scenario.tenant.id)

    const filed = await client
      .post('/api/v1/content-reports')
      .headers(headers)
      .loginAs(reporter)
      .json({ target_type: 'experience', target_id: content.id, reason: 'spam' })
    filed.assertStatus(201)

    const queue = await client.get('/backoffice/reports').headers(headers).loginAs(moderator)
    assert.include(queue.text(), 'Oficina de latte art')
    assert.include(queue.text(), '"type":"experience"')

    const visible = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/experiences`)
      .headers(publicHeaders(scenario))
    assert.lengthOf(visible.body().data, 1)

    const resolved = await client
      .post(`/api/v1/admin/content-reports/${filed.body().id}/resolve`)
      .headers(headers)
      .loginAs(moderator)
      .json({ status: 'resolved', resolution_action: 'content_hidden' })
    resolved.assertStatus(200)

    // Hiding partner content is archiving it, with the moderator as author —
    // the same act as archiving from the moderation screen.
    await content.refresh()
    assert.equal(content.status, 'archived')
    assert.equal(content.archived_by, moderator.id)

    const gone = await client
      .get(`/api/v1/catalog/establishments/${establishment.id}/experiences`)
      .headers(publicHeaders(scenario))
    assert.lengthOf(gone.body().data, 0)
  })

  test('only content the public could see can be reported', async ({ client }) => {
    const scenario = await createEstablishmentScenario('pcr-visible')
    const establishment = await createPublishedEstablishment(scenario)
    const reporter = await createUser({ prefix: 'pcr-visible-reporter', tenant: scenario.tenant })
    const headers = tenantHeader(scenario.tenant.id)

    const draft = await experience(scenario, establishment, 'draft')
    const archived = await experience(scenario, establishment, 'archived')

    for (const target of [draft, archived]) {
      const response = await client
        .post('/api/v1/content-reports')
        .headers(headers)
        .loginAs(reporter)
        .json({ target_type: 'experience', target_id: target.id, reason: 'spam' })
      response.assertStatus(404)
    }

    // Wrong species with a real number is a miss, not a match on something else.
    const wrongKind = await client
      .post('/api/v1/content-reports')
      .headers(headers)
      .loginAs(reporter)
      .json({ target_type: 'event', target_id: draft.id, reason: 'spam' })
    wrongKind.assertStatus(404)
  })

  test('content of an establishment that left the catalogue cannot be reported', async ({
    client,
  }) => {
    const scenario = await createEstablishmentScenario('pcr-withdrawn')
    const establishment = await createPublishedEstablishment(scenario)
    const reporter = await createUser({ prefix: 'pcr-withdrawn-reporter', tenant: scenario.tenant })
    const content = await experience(scenario, establishment)

    establishment.lifecycle_status = 'suspended'
    establishment.suspended_at = DateTime.utc()
    await establishment.save()

    const response = await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({ target_type: 'experience', target_id: content.id, reason: 'spam' })
    response.assertStatus(404)
  })

  test('a partner reply is reported as `reply`, the value the validator accepts', async ({
    client,
  }) => {
    // The document used to say `review_reply`, the app was generated from it,
    // and every reply report the app sent was refused.
    const scenario = await createEstablishmentScenario('pcr-reply')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'pcr-reply-author', tenant: scenario.tenant })
    const reporter = await createUser({ prefix: 'pcr-reply-reporter', tenant: scenario.tenant })
    const review = await EstablishmentReview.create({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      user_id: author.id,
      rating: 3,
      comment: 'Razoável.',
      status: 'published',
      photos_count: 0,
      videos_count: 0,
    })
    const reply = await EstablishmentReviewReply.create({
      tenant_id: scenario.tenant.id,
      review_id: review.id,
      organization_id: scenario.organization.id,
      user_id: scenario.owner.id,
      comment: 'Resposta com contato publicado em desacordo.',
      status: 'published',
    })
    const headers = tenantHeader(scenario.tenant.id)

    const accepted = await client
      .post('/api/v1/content-reports')
      .headers(headers)
      .loginAs(reporter)
      .json({ target_type: 'reply', target_id: reply.id, reason: 'inappropriate' })
    accepted.assertStatus(201)

    const legacy = await client
      .post('/api/v1/content-reports')
      .headers(headers)
      .loginAs(author)
      .json({ target_type: 'review_reply', target_id: reply.id, reason: 'inappropriate' })
    legacy.assertStatus(422)
  })
})

test.group('Signed-in reports follow the public-visibility rule', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a hidden review answers like a missing one, signed in or not', async ({ client }) => {
    // The signed-in route used to check only that the target existed, so any
    // account could ask, one number at a time, what the catalogue hides.
    const scenario = await createEstablishmentScenario('pcr-signed-hidden')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'pcr-signed-author', tenant: scenario.tenant })
    const reporter = await createUser({ prefix: 'pcr-signed-reporter', tenant: scenario.tenant })
    const hidden = await EstablishmentReview.create({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      user_id: author.id,
      rating: 1,
      comment: 'Já ocultada pela moderação.',
      status: 'hidden',
      photos_count: 0,
      videos_count: 0,
    })

    const signedIn = await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: hidden.id, reason: 'spam' })
    signedIn.assertStatus(404)

    const missing = await client
      .post('/api/v1/content-reports')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(reporter)
      .json({ target_type: 'review', target_id: 2147480000, reason: 'spam' })
    missing.assertStatus(404)
  })
})
