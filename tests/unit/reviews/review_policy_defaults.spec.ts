import { test } from '@japa/runner'

import IReview from '#modules/reviews/interfaces/review_interface'
import ReviewPolicy from '#modules/reviews/models/review_policy'

test.group('Review policy defaults and invariants (ADR-0027)', () => {
  test('uses the exact 8 default parameters defined in ADR-0027', ({ assert }) => {
    assert.deepEqual(IReview.DEFAULT_REVIEW_POLICY, {
      require_visit_proof: false,
      min_text_length: 0,
      max_text_length: 1000,
      max_photos: 4,
      max_videos: 0,
      daily_limit_per_user: 5,
      min_edit_interval_minutes: 60,
      edit_window_days: 30,
    })
  })

  test('keeps video upload limit at zero per ADR-0014 scope divergence', ({ assert }) => {
    assert.equal(IReview.DEFAULT_REVIEW_POLICY.max_videos, 0)
  })

  test('keeps visit proof requirement disabled by default', ({ assert }) => {
    assert.isFalse(IReview.DEFAULT_REVIEW_POLICY.require_visit_proof)
  })

  test('allows optional text with default min_text_length = 0', ({ assert }) => {
    assert.equal(IReview.DEFAULT_REVIEW_POLICY.min_text_length, 0)
    assert.equal(IReview.DEFAULT_REVIEW_POLICY.max_text_length, 1000)
    assert.isTrue(
      IReview.DEFAULT_REVIEW_POLICY.min_text_length <= IReview.DEFAULT_REVIEW_POLICY.max_text_length
    )
  })

  test('ReviewPolicy model maps to review_policies table with snake_case naming', ({ assert }) => {
    assert.equal(ReviewPolicy.table, 'review_policies')
    const policy = new ReviewPolicy()
    policy.tenant_id = 1
    policy.require_visit_proof = IReview.DEFAULT_REVIEW_POLICY.require_visit_proof
    policy.min_text_length = IReview.DEFAULT_REVIEW_POLICY.min_text_length
    policy.max_text_length = IReview.DEFAULT_REVIEW_POLICY.max_text_length
    policy.max_photos = IReview.DEFAULT_REVIEW_POLICY.max_photos
    policy.max_videos = IReview.DEFAULT_REVIEW_POLICY.max_videos
    policy.daily_limit_per_user = IReview.DEFAULT_REVIEW_POLICY.daily_limit_per_user
    policy.min_edit_interval_minutes = IReview.DEFAULT_REVIEW_POLICY.min_edit_interval_minutes
    policy.edit_window_days = IReview.DEFAULT_REVIEW_POLICY.edit_window_days

    assert.equal(policy.tenant_id, 1)
    assert.isFalse(policy.require_visit_proof)
    assert.equal(policy.max_photos, 4)
    assert.equal(policy.max_videos, 0)
    assert.equal(policy.daily_limit_per_user, 5)
    assert.equal(policy.min_edit_interval_minutes, 60)
    assert.equal(policy.edit_window_days, 30)
  })
})
