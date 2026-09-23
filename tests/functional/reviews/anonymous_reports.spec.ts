import { createHash } from 'node:crypto'

import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import type Establishment from '#modules/establishments/models/establishment'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import IRoles from '#modules/roles/interfaces/role_interface'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const ROUTE = '/api/v1/catalog/content-reports'

const from = (scenario: EstablishmentScenario, ip: string) => ({
  'host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-for': ip,
})

async function reviewOf(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  status: 'published' | 'hidden' = 'published'
) {
  const author = await createUser({ prefix: 'anon-author', tenant: scenario.tenant })
  const review = await EstablishmentReview.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    user_id: author.id,
    rating: 1,
    comment: 'Texto denunciado anonimamente.',
    status,
    photos_count: 0,
    videos_count: 0,
  })
  return { review, author }
}

async function expectStatus(
  request: PromiseLike<{ assertStatus(status: number): void }>,
  status: number
) {
  const response = await request
  response.assertStatus(status)
}

const stored = (protocol: string) =>
  db.from('content_reports').where('protocol_number', protocol).first()

test.group('Anonymous reports (ADR-0027 scenarios 13 and 14)', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    const rollback = await testUtils.db().withGlobalTransaction()
    return async () => {
      await rollback()
      await limiter.clear()
    }
  })

  test('a visitor reports without a session and gets only a protocol back', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('anon-accept')
    const establishment = await createPublishedEstablishment(scenario)
    const { review } = await reviewOf(scenario, establishment)
    const ip = '203.0.113.10'
    const token = 'a3c1f1e0-6b2a-4d5e-9f10-8c7b6a5d4e3f'

    const response = await client.post(ROUTE).headers(from(scenario, ip)).json({
      target_type: 'review',
      target_id: review.id,
      reason: 'offensive',
      details: 'Ofende a equipe.',
      anonymous_token: token,
    })

    response.assertStatus(201)
    assert.deepEqual(Object.keys(response.body()), ['protocol_number'])
    assert.equal(response.header('cache-control'), 'private, no-store')

    const row = await stored(response.body().protocol_number)
    assert.isTrue(row.is_anonymous)
    assert.isNull(row.reporter_id)
    assert.equal(row.tenant_id, scenario.tenant.id)
    assert.equal(row.status, 'pending')

    // Keyed, never a bare digest: a SHA-256 of an IPv4 address is reversible by
    // trying them all.
    assert.match(row.reporter_ip_hash, /^[0-9a-f]{64}$/)
    assert.notEqual(row.reporter_ip_hash, createHash('sha256').update(ip).digest('hex'))
    assert.notEqual(row.reporter_token_hash, createHash('sha256').update(token).digest('hex'))
    const everything = JSON.stringify(row)
    assert.notInclude(everything, ip)
    assert.notInclude(everything, token)
  })

  test('the same origin reporting the same target again is a repeat', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('anon-repeat-ip')
    const establishment = await createPublishedEstablishment(scenario)
    const { review } = await reviewOf(scenario, establishment)
    const body = { target_type: 'review', target_id: review.id, reason: 'spam' }

    const first = await client.post(ROUTE).headers(from(scenario, '203.0.113.20')).json(body)
    first.assertStatus(201)

    const again = await client.post(ROUTE).headers(from(scenario, '203.0.113.20')).json(body)
    again.assertStatus(409)
    // Nothing about the earlier report comes back.
    assert.notInclude(JSON.stringify(again.body()), first.body().protocol_number)

    const count = await db
      .from('content_reports')
      .where('target_type', 'review')
      .where('target_id', review.id)
      .count('* as total')
    assert.equal(Number(count[0].total), 1)
  })

  test('the same token from another network is a repeat too', async ({ client }) => {
    const scenario = await createEstablishmentScenario('anon-repeat-token')
    const establishment = await createPublishedEstablishment(scenario)
    const { review } = await reviewOf(scenario, establishment)
    const body = {
      target_type: 'review',
      target_id: review.id,
      reason: 'spam',
      anonymous_token: 'b4d2e2f1-7c3b-4e6f-a011-9d8c7b6a5f40',
    }

    const home = await client.post(ROUTE).headers(from(scenario, '198.51.100.1')).json(body)
    home.assertStatus(201)

    const mobile = await client.post(ROUTE).headers(from(scenario, '198.51.100.99')).json(body)
    mobile.assertStatus(409)
  })

  test('a different target, or a different person, is not a repeat', async ({ client }) => {
    const scenario = await createEstablishmentScenario('anon-distinct')
    const establishment = await createPublishedEstablishment(scenario)
    const { review: first } = await reviewOf(scenario, establishment)
    const { review: second } = await reviewOf(scenario, establishment)

    const one = await client
      .post(ROUTE)
      .headers(from(scenario, '203.0.113.30'))
      .json({ target_type: 'review', target_id: first.id, reason: 'spam' })
    one.assertStatus(201)

    const otherTarget = await client
      .post(ROUTE)
      .headers(from(scenario, '203.0.113.30'))
      .json({ target_type: 'review', target_id: second.id, reason: 'spam' })
    otherTarget.assertStatus(201)

    const otherPerson = await client
      .post(ROUTE)
      .headers(from(scenario, '203.0.113.31'))
      .json({ target_type: 'review', target_id: first.id, reason: 'spam' })
    otherPerson.assertStatus(201)
  })

  test('one person’s reports cannot be linked to each other by their hashes', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('anon-unlinkable')
    const establishment = await createPublishedEstablishment(scenario)
    const { review: first } = await reviewOf(scenario, establishment)
    const { review: second } = await reviewOf(scenario, establishment)
    const token = 'c5e3f302-8d4c-4f70-b122-ae9d8c7b6a51'

    const one = await client
      .post(ROUTE)
      .headers(from(scenario, '203.0.113.40'))
      .json({ target_type: 'review', target_id: first.id, reason: 'spam', anonymous_token: token })
    const two = await client
      .post(ROUTE)
      .headers(from(scenario, '203.0.113.40'))
      .json({ target_type: 'review', target_id: second.id, reason: 'spam', anonymous_token: token })

    const a = await stored(one.body().protocol_number)
    const b = await stored(two.body().protocol_number)
    assert.notEqual(a.reporter_ip_hash, b.reporter_ip_hash)
    assert.notEqual(a.reporter_token_hash, b.reporter_token_hash)
  })

  test('the moderator sees an anonymous report and nothing that identifies it', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('anon-queue')
    const establishment = await createPublishedEstablishment(scenario)
    const { review } = await reviewOf(scenario, establishment)
    const moderator = await createUser({
      prefix: 'anon-moderator',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })
    const ip = '203.0.113.50'
    const token = 'd6f40413-9e5d-4081-8233-bf0e9d8c7b62'

    const filed = await client.post(ROUTE).headers(from(scenario, ip)).json({
      target_type: 'review',
      target_id: review.id,
      reason: 'harassment',
      anonymous_token: token,
    })
    const row = await stored(filed.body().protocol_number)
    const tenantHeaders = { 'x-tenant-id': String(scenario.tenant.id) }

    const page = await client.get('/backoffice/reports').headers(tenantHeaders).loginAs(moderator)
    const api = await client
      .get('/api/v1/admin/content-reports')
      .headers(tenantHeaders)
      .loginAs(moderator)

    page.assertStatus(200)
    api.assertStatus(200)
    assert.include(page.text(), filed.body().protocol_number)
    assert.include(page.text(), '"is_anonymous":true')
    for (const secret of [ip, token, row.reporter_ip_hash, row.reporter_token_hash]) {
      assert.notInclude(page.text(), secret)
      assert.notInclude(api.text(), secret)
    }
    assert.notInclude(page.text(), 'reporter_ip_hash')
    assert.notInclude(api.text(), 'reporter_token_hash')
  })

  test('only what the public can see can be reported anonymously', async ({ client }) => {
    const scenario = await createEstablishmentScenario('anon-visible')
    const establishment = await createPublishedEstablishment(scenario)
    const { review: hidden } = await reviewOf(scenario, establishment, 'hidden')
    const { review: byBanned, author } = await reviewOf(scenario, establishment)
    await db
      .from('user_tenants')
      .where('user_id', author.id)
      .where('tenant_id', scenario.tenant.id)
      .update({ banned_at: new Date(), banned_by: scenario.owner.id, ban_reason: 'teste' })
    const draft = await EstablishmentExperience.create({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      created_by: scenario.owner.id,
      title: 'Rascunho',
      description: null,
      status: 'draft',
      published_snapshot: null,
      published_at: null,
      archived_by: null,
      archived_at: null,
    })
    const published = await EstablishmentExperience.create({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      created_by: scenario.owner.id,
      title: 'Oficina',
      description: 'Publicada.',
      status: 'published',
      published_snapshot: { title: 'Oficina', description: 'Publicada.' },
      published_at: DateTime.utc(),
      archived_by: null,
      archived_at: null,
    })

    let ip = 60
    const attempt = (target_type: string, target_id: number) =>
      client
        .post(ROUTE)
        .headers(from(scenario, `203.0.113.${ip++}`))
        .json({ target_type, target_id, reason: 'spam' })

    await expectStatus(attempt('review', hidden.id), 404)
    await expectStatus(attempt('review', byBanned.id), 404)
    await expectStatus(attempt('experience', draft.id), 404)
    await expectStatus(attempt('establishment', 2147480000), 404)
    await expectStatus(attempt('experience', published.id), 201)
    await expectStatus(attempt('establishment', establishment.id), 201)

    establishment.lifecycle_status = 'suspended'
    establishment.suspended_at = DateTime.utc()
    await establishment.save()
    await expectStatus(attempt('establishment', establishment.id), 404)
  })

  test('the operation comes from the hostname, never from the visitor', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('anon-host')
    const other = await createEstablishmentScenario('anon-host-other')
    const establishment = await createPublishedEstablishment(scenario)
    const { review } = await reviewOf(scenario, establishment)

    const response = await client
      .post(ROUTE)
      .headers({ ...from(scenario, '203.0.113.70'), 'x-tenant-id': String(other.tenant.id) })
      .json({ target_type: 'review', target_id: review.id, reason: 'spam' })

    response.assertStatus(201)
    const row = await stored(response.body().protocol_number)
    assert.equal(row.tenant_id, scenario.tenant.id)
  })

  test('one connection cannot flood the queue', async ({ client }) => {
    const scenario = await createEstablishmentScenario('anon-flood')
    const headers = from(scenario, '203.0.113.80')
    const body = { target_type: 'review', target_id: 2147480000, reason: 'spam' }

    for (let attempt = 0; attempt < 5; attempt++) {
      await expectStatus(client.post(ROUTE).headers(headers).json(body), 404)
    }
    await expectStatus(client.post(ROUTE).headers(headers).json(body), 429)
  })

  test('an anonymous token must look like a token', async ({ client }) => {
    const scenario = await createEstablishmentScenario('anon-token-shape')
    const establishment = await createPublishedEstablishment(scenario)
    const { review } = await reviewOf(scenario, establishment)

    const response = await client.post(ROUTE).headers(from(scenario, '203.0.113.90')).json({
      target_type: 'review',
      target_id: review.id,
      reason: 'spam',
      anonymous_token: "x'; DROP TABLE content_reports; --",
    })
    response.assertStatus(422)
  })
})
