import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import type Establishment from '#modules/establishments/models/establishment'
import EstablishmentExperience from '#modules/partner_content/models/establishment_experience'
import type { PartnerPlacesPageProps, PortalTasks } from '#modules/portal/interfaces/portal_pages'
import type { PartnerReviewsPageProps } from '#modules/reviews/interfaces/partner_reviews_page'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import type User from '#modules/users/models/user'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import {
  addOrganizationMember,
  createOrganization,
  createUser,
} from '#tests/functional/organizations/helpers'

const tenantHeader = (tenantId: number) => ({ 'x-tenant-id': String(tenantId) })

function parsePage<T>(response: { text(): string }, component: string): T {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match?.[1]) throw new Error('The response does not contain an Inertia page payload')
  const page = JSON.parse(match[1]) as { component: string; props: unknown }
  if (page.component !== component) throw new Error(`Unexpected component: ${page.component}`)
  return page.props as T
}

async function review(
  scenario: EstablishmentScenario,
  establishment: Establishment,
  author: User,
  overrides: Partial<{ rating: number; comment: string; status: 'published' | 'hidden' }> = {}
) {
  return EstablishmentReview.create({
    tenant_id: scenario.tenant.id,
    establishment_id: establishment.id,
    user_id: author.id,
    rating: overrides.rating ?? 4,
    comment: overrides.comment ?? 'Porções generosas e ambiente animado.',
    status: overrides.status ?? 'published',
    photos_count: 0,
    videos_count: 0,
  })
}

async function reply(scenario: EstablishmentScenario, reviewId: number, comment: string) {
  return EstablishmentReviewReply.create({
    tenant_id: scenario.tenant.id,
    review_id: reviewId,
    organization_id: scenario.organization.id,
    user_id: scenario.owner.id,
    comment,
    status: 'published',
  })
}

/** A place with one review waiting, one answered, one hidden and one by a banned author. */
async function placeWithReviews(prefix: string) {
  const scenario = await createEstablishmentScenario(prefix)
  const place = await createPublishedEstablishment(scenario, 'Casa de Petiscos')
  const author = (name: string) =>
    createUser({ prefix: `${prefix}-${name}`, tenant: scenario.tenant, tenantRole: 'member' })

  const waiting = await review(scenario, place, await author('ana'), { rating: 5 })
  const answered = await review(scenario, place, await author('bia'), { rating: 3 })
  await reply(scenario, answered.id, 'Obrigado pelo retorno!')
  await review(scenario, place, await author('caio'), { status: 'hidden' })
  const bannedAuthor = await author('dora')
  await review(scenario, place, bannedAuthor, { rating: 1 })
  await db
    .from('user_tenants')
    .where('tenant_id', scenario.tenant.id)
    .where('user_id', bannedAuthor.id)
    .update({ banned_at: new Date(), banned_by: scenario.owner.id, ban_reason: 'teste' })

  return { scenario, place, waiting, answered }
}

test.group('Partner portal — reviews', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('lists the published reviews of the place, opening on the ones waiting for an answer', async ({
    client,
    assert,
  }) => {
    const { scenario, place, waiting, answered } = await placeWithReviews('pr-list')

    const response = await client
      .get('/portal/reviews')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'private, no-store')
    assert.equal(response.header('x-robots-tag'), 'noindex, nofollow')
    const props = parsePage<PartnerReviewsPageProps>(response, 'portal/reviews/index')

    assert.deepEqual(props.places, [
      { id: place.id, name: 'Casa de Petiscos', can_reply: true, unanswered: 1 },
    ])
    assert.equal(props.selected_place_id, place.id)
    assert.equal(props.filter, 'unanswered')
    // Hidden reviews and a banned author's stay out, as they do in public.
    assert.deepEqual(props.counts, { unanswered: 1, answered: 1, all: 2 })
    assert.equal(props.average, 4)
    assert.deepEqual(
      props.reviews.map((item) => item.id),
      [waiting.id]
    )
    assert.isNull(props.reviews[0].reply)
    // The page draws its pagination from these; they must be numbers, not null.
    assert.deepEqual(props.meta, { current_page: 1, last_page: 1, total: 1 })

    const answeredPage = parsePage<PartnerReviewsPageProps>(
      await client
        .get(`/portal/reviews?establishment=${place.id}&filter=answered`)
        .headers(tenantHeader(scenario.tenant.id))
        .loginAs(scenario.owner),
      'portal/reviews/index'
    )
    assert.deepEqual(
      answeredPage.reviews.map((item) => item.id),
      [answered.id]
    )
    assert.equal(answeredPage.reviews[0].reply?.comment, 'Obrigado pelo retorno!')

    const everything = parsePage<PartnerReviewsPageProps>(
      await client
        .get(`/portal/reviews?filter=all`)
        .headers(tenantHeader(scenario.tenant.id))
        .loginAs(scenario.owner),
      'portal/reviews/index'
    )
    assert.lengthOf(everything.reviews, 2)
  })

  test('answers and edits a review from the page, through the same rules as the API', async ({
    client,
    assert,
  }) => {
    const { scenario, waiting } = await placeWithReviews('pr-reply')
    const editor = await createUser({
      prefix: 'pr-reply-editor',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: editor,
      role: 'editor',
    })
    const post = (comment: string) =>
      client
        .post(`/portal/reviews/${waiting.id}/reply`)
        .withCsrfToken()
        .redirects(0)
        .headers({ ...tenantHeader(scenario.tenant.id), referer: '/portal/reviews' })
        .loginAs(editor)
        .json({ comment })

    const created = await post('Obrigado pela visita!')
    created.assertStatus(302)
    created.assertFlashMessage(
      'success',
      'Resposta publicada. Ela aparece abaixo da avaliação, no app e no site.'
    )
    const stored = await EstablishmentReviewReply.findByOrFail('review_id', waiting.id)
    assert.equal(stored.comment, 'Obrigado pela visita!')
    assert.equal(stored.status, 'published')

    // Answering twice, from a stale tab, says so instead of failing loudly.
    const twice = await post('Segunda resposta.')
    twice.assertStatus(302)
    twice.assertFlashMessage(
      'error',
      'Esta avaliação já tem resposta. Atualize a página para editar a resposta publicada.'
    )
    assert.lengthOf(await EstablishmentReviewReply.query().where('review_id', waiting.id), 1)

    const edited = await client
      .put(`/portal/reviews/${waiting.id}/reply`)
      .withCsrfToken()
      .redirects(0)
      .headers({ ...tenantHeader(scenario.tenant.id), referer: '/portal/reviews' })
      .loginAs(editor)
      .json({ comment: 'Obrigado pela visita, volte sempre!' })
    edited.assertStatus(302)
    await stored.refresh()
    assert.equal(stored.comment, 'Obrigado pela visita, volte sempre!')
    assert.isNotNull(stored.edited_at)
  })

  test('refuses an empty answer in Portuguese and an answer without the CSRF token', async ({
    client,
    assert,
  }) => {
    const { scenario, waiting } = await placeWithReviews('pr-validate')

    const empty = await client
      .post(`/portal/reviews/${waiting.id}/reply`)
      .withCsrfToken()
      .redirects(0)
      .header('x-inertia', 'true')
      .headers({ ...tenantHeader(scenario.tenant.id), referer: '/portal/reviews' })
      .loginAs(scenario.owner)
      .json({ comment: '   ' })
    empty.assertStatus(302)
    empty.assertFlashMessage('inputErrorsBag', {
      comment: ['Escreva a resposta antes de publicar.'],
    })

    const forged = await client
      .post(`/portal/reviews/${waiting.id}/reply`)
      .redirects(0)
      .headers({ ...tenantHeader(scenario.tenant.id), referer: '/portal/reviews' })
      .loginAs(scenario.owner)
      .json({ comment: 'Sem token.' })
    forged.assertStatus(302)
    forged.assertFlashMessage('errorsBag', { E_BAD_CSRF_TOKEN: 'Invalid or expired CSRF token' })
    assert.isNull(await EstablishmentReviewReply.findBy('review_id', waiting.id))
  })

  test('keeps another organization, a customer and a read-only role out of answering', async ({
    client,
    assert,
  }) => {
    const { scenario, place, waiting } = await placeWithReviews('pr-authz')
    const headers = { ...tenantHeader(scenario.tenant.id), referer: '/portal/reviews' }

    const rivalOwner = await createUser({
      prefix: 'pr-authz-rival',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    await createOrganization({
      tenant: scenario.tenant,
      owner: rivalOwner,
      status: 'active',
      prefix: 'Rival',
    })
    const customer = await createUser({
      prefix: 'pr-authz-customer',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    const analyst = await createUser({
      prefix: 'pr-authz-analyst',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: analyst,
      role: 'analyst',
    })

    // Another organization's partner sees none of these reviews and cannot ask for them.
    const rivalPage = parsePage<PartnerReviewsPageProps>(
      await client.get('/portal/reviews').headers(headers).loginAs(rivalOwner),
      'portal/reviews/index'
    )
    assert.deepEqual(rivalPage.places, [])
    assert.deepEqual(rivalPage.reviews, [])
    const rivalAsks = await client
      .get(`/portal/reviews?establishment=${place.id}`)
      .headers(headers)
      .loginAs(rivalOwner)
    rivalAsks.assertStatus(404)

    for (const outsider of [rivalOwner, customer]) {
      const attempt = await client
        .post(`/portal/reviews/${waiting.id}/reply`)
        .withCsrfToken()
        .redirects(0)
        .headers(headers)
        .loginAs(outsider)
        .json({ comment: 'Resposta de fora.' })
      attempt.assertStatus(404)
    }

    // An analyst reads the reviews, is told they cannot answer, and the service agrees.
    const analystPage = parsePage<PartnerReviewsPageProps>(
      await client.get('/portal/reviews').headers(headers).loginAs(analyst),
      'portal/reviews/index'
    )
    assert.isFalse(analystPage.places[0].can_reply)
    const analystAttempt = await client
      .post(`/portal/reviews/${waiting.id}/reply`)
      .withCsrfToken()
      .redirects(0)
      .headers(headers)
      .loginAs(analyst)
      .json({ comment: 'Resposta de analista.' })
    analystAttempt.assertStatus(403)

    assert.isNull(await EstablishmentReviewReply.findBy('review_id', waiting.id))
  })

  test('never crosses operations: another tenant review and place answer like missing ones', async ({
    client,
  }) => {
    const home = await placeWithReviews('pr-tenant-a')
    const away = await placeWithReviews('pr-tenant-b')
    const headers = { ...tenantHeader(home.scenario.tenant.id), referer: '/portal/reviews' }

    const foreignPlace = await client
      .get(`/portal/reviews?establishment=${away.place.id}`)
      .headers(headers)
      .loginAs(home.scenario.owner)
    foreignPlace.assertStatus(404)

    const foreignReply = await client
      .post(`/portal/reviews/${away.waiting.id}/reply`)
      .withCsrfToken()
      .redirects(0)
      .headers(headers)
      .loginAs(home.scenario.owner)
      .json({ comment: 'Resposta cruzada.' })
    foreignReply.assertStatus(404)
  })
})

test.group('Partner portal — overview tasks and entry points', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('counts the day tasks from the same definitions the pages use', async ({
    client,
    assert,
  }) => {
    const { scenario, place } = await placeWithReviews('pr-tasks')
    for (const status of ['draft', 'draft', 'pending_review', 'published'] as const) {
      await EstablishmentExperience.create({
        tenant_id: scenario.tenant.id,
        establishment_id: place.id,
        created_by: scenario.owner.id,
        title: 'Degustação guiada',
        description: 'Uma hora de cafés especiais.',
        status,
        published_snapshot:
          status === 'published'
            ? { title: 'Degustação guiada', description: 'Uma hora de cafés especiais.' }
            : null,
        published_at: status === 'published' ? DateTime.utc() : null,
        archived_by: null,
        archived_at: null,
      })
    }

    const overview = await client
      .get('/portal')
      .headers(tenantHeader(scenario.tenant.id))
      .loginAs(scenario.owner)
    overview.assertStatus(200)
    const { tasks } = parsePage<{ tasks: PortalTasks }>(overview, 'portal/index')

    assert.equal(tasks.unanswered_reviews, 1)
    assert.deepEqual(tasks.places, {
      total: 1,
      published: 1,
      pending_review: 0,
      changes_requested: 0,
      draft: 0,
    })
    assert.deepEqual(tasks.content, { pending_review: 1, draft: 2, published: 1 })
  })

  test('sends the menu entries straight to the only place and organization, or lets the partner choose', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('pr-entry')
    const first = await createPublishedEstablishment(scenario, 'Ateliê do Café')
    const headers = tenantHeader(scenario.tenant.id)

    const onePlace = await client
      .get('/portal/establishments')
      .redirects(0)
      .headers(headers)
      .loginAs(scenario.owner)
    onePlace.assertStatus(302)
    onePlace.assertHeader('location', `/portal/establishments/${first.id}`)

    const performance = await client
      .get('/portal/performance')
      .redirects(0)
      .headers(headers)
      .loginAs(scenario.owner)
    performance.assertStatus(302)
    performance.assertHeader('location', `/organizations/${scenario.organization.id}/analytics`)

    const second = await createPublishedEstablishment(scenario, 'Casa de Petiscos')
    const chooser = await client
      .get('/portal/establishments')
      .headers(headers)
      .loginAs(scenario.owner)
    chooser.assertStatus(200)
    assert.equal(chooser.header('cache-control'), 'private, no-store')
    const page = parsePage<PartnerPlacesPageProps>(chooser, 'portal/establishments/index')
    assert.sameMembers(
      page.organizations[0].places.map((item) => item.id),
      [first.id, second.id]
    )
    assert.isTrue(page.organizations[0].places.every((item) => item.state === 'published'))

    const customer = await createUser({
      prefix: 'pr-entry-customer',
      tenant: scenario.tenant,
      tenantRole: 'member',
    })
    const nothing = await client
      .get('/portal/establishments')
      .redirects(0)
      .headers(headers)
      .loginAs(customer)
    nothing.assertStatus(302)
    nothing.assertHeader('location', '/portal')
  })
})
