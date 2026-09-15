import { test } from '@japa/runner'

import IReview from '#modules/reviews/interfaces/review_interface'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'

test.group('Establishment review reply invariants (ADR-0027)', () => {
  test('recognizes only canonical reply statuses', ({ assert }) => {
    assert.sameMembers([...IReview.CANONICAL_REPLY_STATUSES], ['published', 'hidden'])
    assert.isTrue(IReview.isReplyStatus('published'))
    assert.isTrue(IReview.isReplyStatus('hidden'))
    assert.isFalse(IReview.isReplyStatus('archived'))
    assert.isFalse(IReview.isReplyStatus('draft'))
  })

  test('EstablishmentReviewReply model maps to establishment_review_replies table', ({ assert }) => {
    assert.equal(EstablishmentReviewReply.table, 'establishment_review_replies')
    const reply = new EstablishmentReviewReply()
    reply.tenant_id = 1
    reply.review_id = 10
    reply.organization_id = 5
    reply.user_id = 20
    reply.comment = 'Agradecemos o feedback!'
    reply.status = 'published'

    assert.equal(reply.tenant_id, 1)
    assert.equal(reply.review_id, 10)
    assert.equal(reply.organization_id, 5)
    assert.equal(reply.user_id, 20)
    assert.equal(reply.comment, 'Agradecemos o feedback!')
    assert.equal(reply.status, 'published')
  })
})
