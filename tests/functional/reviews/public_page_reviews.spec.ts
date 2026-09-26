import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import type Establishment from '#modules/establishments/models/establishment'
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
  'x-forwarded-for': `198.51.100.${(scenario.tenant.id % 250) + 1}`,
})

type PageReviews = {
  summary: { count: number; average: number | null }
  latest: Record<string, unknown>[]
}

function parseInertiaPage(response: { text(): string }): {
  component: string
  props: Record<string, unknown>
} {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('The response does not contain an Inertia page payload')
  return JSON.parse(match[1])
}

async function pagePath(scenario: EstablishmentScenario, establishment: Establishment) {
  const row = await db
    .from('catalog_establishments')
    .where('tenant_id', scenario.tenant.id)
    .where('establishment_id', establishment.id)
    .select('city_slug', 'establishment_slug')
    .firstOrFail()
  return `/cidades/${row.city_slug}/estabelecimentos/${row.establishment_slug}`
}

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

/**
 * W10 of the web audit: the public web page of a place shows its reviews.
 * The page is cached as `public`, so the payload is asserted field by field —
 * what reaches the HTML is exactly the display projection, nothing more.
 */
test.group('Reviews - public web page (W10)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('carries the summary and the three latest published reviews, with their replies', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('rev-page')
    const establishment = await createPublishedEstablishment(scenario, 'Bar da Pagina')
    const authors = []
    for (const index of [1, 2, 3, 4, 5]) {
      authors.push(await createUser({ prefix: `rev-page-${index}`, tenant: scenario.tenant }))
    }

    await review(scenario, establishment, authors[0].id, 5)
    const third = await review(scenario, establishment, authors[1].id, 4)
    await review(scenario, establishment, authors[2].id, 1, 'hidden')
    const answered = await review(scenario, establishment, authors[3].id, 4)
    const latest = await review(scenario, establishment, authors[4].id, 5)
    await EstablishmentReviewReply.create({
      tenant_id: scenario.tenant.id,
      review_id: answered.id,
      user_id: scenario.owner.id,
      organization_id: scenario.organization.id,
      comment: 'Obrigado pela visita!',
      status: 'published',
    })

    const response = await client
      .get(await pagePath(scenario, establishment))
      .headers(publicHeaders(scenario))
    response.assertStatus(200)

    const page = parseInertiaPage(response)
    assert.equal(page.component, 'catalog/establishment')
    const reviews = page.props.reviews as PageReviews

    // The same aggregate as the catalogue projection: the hidden review counts
    // neither in the list nor in the average.
    assert.deepEqual(reviews.summary, { count: 4, average: 4.5 })
    // Newest first and only three: the oldest published review stays in the
    // count but not in the list.
    assert.deepEqual(
      reviews.latest.map((item) => item.id),
      [latest.id, answered.id, third.id]
    )

    const withReply = reviews.latest.find((item) => item.id === answered.id)!
    assert.deepInclude(withReply, {
      rating: 4,
      comment: 'Avaliação 4',
      author_name: authors[3].full_name,
      photos: [],
    })
    assert.equal((withReply.reply as { comment: string }).comment, 'Obrigado pela visita!')

    // A display name and nothing that identifies the account behind it.
    assert.sameMembers(Object.keys(withReply), [
      'id',
      'rating',
      'comment',
      'created_at',
      'author_name',
      'reply',
      'photos',
    ])
    const html = response.text()
    for (const author of authors) {
      assert.notInclude(html, author.email)
      assert.notInclude(html, author.username!)
    }
  })

  test('says there is nothing to read when a place has no published review', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('rev-page-empty')
    const establishment = await createPublishedEstablishment(scenario, 'Bar Sem Avaliacao')

    const response = await client
      .get(await pagePath(scenario, establishment))
      .headers(publicHeaders(scenario))
    response.assertStatus(200)

    assert.deepEqual(parseInertiaPage(response).props.reviews, {
      summary: { count: 0, average: null },
      latest: [],
    })
  })

  test('hides a banned author on the page exactly as the public listing does', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('rev-page-ban')
    const establishment = await createPublishedEstablishment(scenario, 'Bar do Banimento')
    const author = await createUser({ prefix: 'rev-page-banned', tenant: scenario.tenant })
    const other = await createUser({ prefix: 'rev-page-other', tenant: scenario.tenant })
    const moderator = await createUser({
      prefix: 'rev-page-moderator',
      tenant: scenario.tenant,
      globalRole: IRoles.Slugs.MODERATOR,
    })

    await review(scenario, establishment, author.id, 1)
    const kept = await review(scenario, establishment, other.id, 5)

    const banned = await client
      .post(`/api/v1/admin/users/${author.id}/ban`)
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(moderator)
      .json({ reason: 'Ofensas repetidas a estabelecimentos.' })
    banned.assertStatus(200)

    const response = await client
      .get(await pagePath(scenario, establishment))
      .headers(publicHeaders(scenario))
    response.assertStatus(200)

    const reviews = parseInertiaPage(response).props.reviews as PageReviews
    assert.deepEqual(reviews.summary, { count: 1, average: 5 })
    assert.deepEqual(
      reviews.latest.map((item) => item.id),
      [kept.id]
    )
    assert.notInclude(response.text(), author.full_name)
  })
})
