import { test } from '@japa/runner'

import IReview from '#modules/reviews/interfaces/review_interface'
import ContentReport from '#modules/reviews/models/content_report'

test.group('Content report invariants (ADR-0027)', () => {
  test('recognizes only canonical polymorphic target types', ({ assert }) => {
    // Partner content joined the queue as ADR-0028 decided; one queue for every
    // reportable content, never a second one per kind.
    assert.sameMembers(
      [...IReview.CANONICAL_REPORT_TARGET_TYPES],
      ['review', 'reply', 'establishment', 'experience', 'event', 'showcase_item']
    )
    assert.isTrue(IReview.isReportTargetType('review'))
    assert.isTrue(IReview.isReportTargetType('reply'))
    assert.isTrue(IReview.isReportTargetType('establishment'))
    assert.isTrue(IReview.isReportTargetType('experience'))
    assert.isTrue(IReview.isReportTargetType('event'))
    assert.isTrue(IReview.isReportTargetType('showcase_item'))
    assert.isFalse(IReview.isReportTargetType('user'))
    assert.isFalse(IReview.isReportTargetType('media'))
    // The value the document once advertised and the validator never accepted.
    assert.isFalse(IReview.isReportTargetType('review_reply'))
  })

  test('recognizes only canonical report reasons', ({ assert }) => {
    assert.sameMembers(
      [...IReview.CANONICAL_REPORT_REASONS],
      [
        'spam',
        'offensive',
        'inappropriate',
        'false_information',
        'conflict_of_interest',
        'harassment',
        'other',
      ]
    )
    assert.isTrue(IReview.isReportReason('spam'))
    assert.isTrue(IReview.isReportReason('offensive'))
    assert.isTrue(IReview.isReportReason('inappropriate'))
    assert.isTrue(IReview.isReportReason('false_information'))
    assert.isTrue(IReview.isReportReason('conflict_of_interest'))
    assert.isTrue(IReview.isReportReason('harassment'))
    assert.isTrue(IReview.isReportReason('other'))
    assert.isFalse(IReview.isReportReason('invalid_reason'))
  })

  test('recognizes only canonical report statuses', ({ assert }) => {
    assert.sameMembers(
      [...IReview.CANONICAL_REPORT_STATUSES],
      ['pending', 'under_review', 'resolved', 'dismissed']
    )
    assert.isTrue(IReview.isReportStatus('pending'))
    assert.isTrue(IReview.isReportStatus('under_review'))
    assert.isTrue(IReview.isReportStatus('resolved'))
    assert.isTrue(IReview.isReportStatus('dismissed'))
    assert.isFalse(IReview.isReportStatus('open'))
    assert.isFalse(IReview.isReportStatus('closed'))
  })

  test('ContentReport model maps to content_reports table with relations', ({ assert }) => {
    assert.equal(ContentReport.table, 'content_reports')
    const report = new ContentReport()
    report.tenant_id = 1
    report.target_type = 'review'
    report.target_id = 50
    report.reporter_id = 12
    report.reason = 'offensive'
    report.details = 'Conteúdo com linguagem inadequada'
    report.status = 'pending'
    report.resolved_by = null
    report.resolved_at = null
    report.resolution_action = null
    report.resolution_notes = null

    assert.equal(report.tenant_id, 1)
    assert.equal(report.target_type, 'review')
    assert.equal(report.target_id, 50)
    assert.equal(report.reporter_id, 12)
    assert.equal(report.reason, 'offensive')
    assert.equal(report.details, 'Conteúdo com linguagem inadequada')
    assert.equal(report.status, 'pending')
    assert.isNull(report.resolved_by)
    assert.isNull(report.resolved_at)
  })
})
