import { test } from '@japa/runner'

import IReview from '#modules/reviews/interfaces/review_interface'
import EstablishmentReview from '#modules/reviews/models/establishment_review'

test.group('Establishment review invariants (ADR-0027)', () => {
  test('validates mandatory integer rating from 1 to 5', ({ assert }) => {
    assert.isTrue(IReview.isValidRating(1))
    assert.isTrue(IReview.isValidRating(2))
    assert.isTrue(IReview.isValidRating(3))
    assert.isTrue(IReview.isValidRating(4))
    assert.isTrue(IReview.isValidRating(5))

    assert.isFalse(IReview.isValidRating(0))
    assert.isFalse(IReview.isValidRating(6))
    assert.isFalse(IReview.isValidRating(-1))
    assert.isFalse(IReview.isValidRating(3.5))
    assert.isFalse(IReview.isValidRating(Number.NaN))
    assert.isFalse(IReview.isValidRating(Number.POSITIVE_INFINITY))
  })

  test('recognizes only canonical review statuses', ({ assert }) => {
    assert.sameMembers([...IReview.CANONICAL_REVIEW_STATUSES], ['published', 'hidden', 'archived'])
    assert.isTrue(IReview.isReviewStatus('published'))
    assert.isTrue(IReview.isReviewStatus('hidden'))
    assert.isTrue(IReview.isReviewStatus('archived'))
    assert.isFalse(IReview.isReviewStatus('draft'))
    assert.isFalse(IReview.isReviewStatus('deleted'))
  })

  test('EstablishmentReview model maps to establishment_reviews table with relations', ({
    assert,
  }) => {
    assert.equal(EstablishmentReview.table, 'establishment_reviews')
    const review = new EstablishmentReview()
    review.tenant_id = 1
    review.establishment_id = 42
    review.user_id = 99
    review.redemption_id = null
    review.rating = 5
    review.comment = 'Excelente experiência!'
    review.status = 'published'
    review.photos_count = 2
    review.videos_count = 0

    assert.equal(review.tenant_id, 1)
    assert.equal(review.establishment_id, 42)
    assert.equal(review.user_id, 99)
    assert.isNull(review.redemption_id)
    assert.equal(review.rating, 5)
    assert.equal(review.comment, 'Excelente experiência!')
    assert.equal(review.status, 'published')
    assert.equal(review.photos_count, 2)
    assert.equal(review.videos_count, 0)
  })

  test('allows nullable redemption reference for optional visit proof', ({ assert }) => {
    const reviewWithoutProof = new EstablishmentReview()
    reviewWithoutProof.redemption_id = null
    assert.isNull(reviewWithoutProof.redemption_id)

    const reviewWithProof = new EstablishmentReview()
    reviewWithProof.redemption_id = 1234
    assert.equal(reviewWithProof.redemption_id, 1234)
  })
})
