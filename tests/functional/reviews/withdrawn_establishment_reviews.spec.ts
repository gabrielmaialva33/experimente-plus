import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import EstablishmentReview from '#modules/reviews/models/establishment_review'
import {
  createEstablishmentScenario,
  createPublishedEstablishment,
  type EstablishmentScenario,
} from '#tests/functional/establishments/helpers'
import { createUser } from '#tests/functional/organizations/helpers'

const publicHeaders = (scenario: EstablishmentScenario) => ({
  'host': `${scenario.tenant.slug}.experimente.test`,
  'x-forwarded-host': `${scenario.tenant.slug}.experimente.test`,
})

test.group('Reviews of a withdrawn establishment (Anexo I items 8 and 14)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('leave public view with the establishment and come back with it', async ({
    client,
    assert,
  }) => {
    const scenario = await createEstablishmentScenario('withdrawn-reviews')
    const establishment = await createPublishedEstablishment(scenario)
    const author = await createUser({ prefix: 'withdrawn-author', tenant: scenario.tenant })
    const review = await EstablishmentReview.create({
      tenant_id: scenario.tenant.id,
      establishment_id: establishment.id,
      user_id: author.id,
      rating: 4,
      comment: 'Visível enquanto o lugar estiver no ar.',
      status: 'published',
      photos_count: 0,
      videos_count: 0,
    })
    const list = () =>
      client
        .get(`/api/v1/catalog/establishments/${establishment.id}/reviews`)
        .headers(publicHeaders(scenario))
    const byId = () =>
      client.get(`/api/v1/catalog/reviews/${review.id}`).headers(publicHeaders(scenario))

    const listedBefore = await list()
    assert.lengthOf(listedBefore.body().data, 1)
    const shownBefore = await byId()
    shownBefore.assertStatus(200)

    establishment.lifecycle_status = 'suspended'
    establishment.suspended_at = DateTime.utc()
    await establishment.save()

    // The review answers like one that does not exist: its address must not
    // stay a way around the withdrawal.
    const listedWhileSuspended = await list()
    assert.lengthOf(listedWhileSuspended.body().data, 0)
    const shownWhileSuspended = await byId()
    shownWhileSuspended.assertStatus(404)

    // Nothing was rewritten: the review is still published, only unreachable.
    await review.refresh()
    assert.equal(review.status, 'published')

    establishment.lifecycle_status = 'active'
    establishment.suspended_at = null
    await establishment.save()

    const listedAfter = await list()
    assert.lengthOf(listedAfter.body().data, 1)
    const shownAfter = await byId()
    shownAfter.assertStatus(200)
  })
})
