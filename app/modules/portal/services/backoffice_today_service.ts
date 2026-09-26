import { inject } from '@adonisjs/core'

import ForbiddenException from '#exceptions/forbidden_exception'
import EstablishmentModerationService from '#modules/establishments/services/establishment_moderation_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import PilotFeedbackService from '#modules/pilot_feedback/services/pilot_feedback_service'
import type {
  BackofficeInboxItem,
  BackofficeTodayPageProps,
} from '#modules/portal/interfaces/backoffice_today_page'
import type IReview from '#modules/reviews/interfaces/review_interface'
import ContentReportDeadlineService from '#modules/reviews/services/content_report_deadline_service'
import ContentReportService from '#modules/reviews/services/content_report_service'
import type User from '#modules/users/models/user'

/** How many items each queue lends to the inbox; the queue itself has the rest. */
export const INBOX_ITEMS_PER_QUEUE = 5

/** How many rows the inbox shows at most. */
export const INBOX_SIZE = 8

type ReportRow = {
  id: number
  target_type: IReview.ReportTargetType
  reason: IReview.ReportReason
  origin: IReview.ReportOrigin
  is_anonymous: boolean
  created_at: string | null
  due_at: string | null
  target: Pick<IReview.ReportTargetProjection, 'title' | 'establishment_name'> | null
}

/**
 * What the operation has to resolve today, read from the queues that own it.
 *
 * Each count and row comes from the service behind the corresponding queue page,
 * so the numbers here are the numbers the operator finds one click later, and
 * every service keeps its own authorization check. The calls run one after the
 * other: they are a handful of indexed reads, and none of them shares a
 * transaction.
 */
@inject()
export default class BackofficeTodayService {
  constructor(
    private organizationPolicy: OrganizationPolicyService,
    private moderationService: EstablishmentModerationService,
    private contentService: PartnerContentService,
    private reportService: ContentReportService,
    private deadlines: ContentReportDeadlineService,
    private feedbackService: PilotFeedbackService
  ) {}

  async overview(
    tenantId: number,
    actor: User,
    now = new Date()
  ): Promise<BackofficeTodayPageProps> {
    const platformAccess = await this.organizationPolicy.resolvePlatformAccess(actor)
    if (platformAccess === null) {
      throw new ForbiddenException('Platform moderation permission is required')
    }

    const revisions = await this.moderationService.list(
      tenantId,
      { page: 1, per_page: INBOX_ITEMS_PER_QUEUE },
      actor
    )

    const contentCounts = {} as Record<IPartnerContent.ContentPath, number>
    const contentItems: BackofficeInboxItem[] = []
    for (const path of IPartnerContent.CANONICAL_CONTENT_PATHS) {
      const page = await this.contentService.listForModeration(
        IPartnerContent.kindOfPath(path),
        tenantId,
        actor,
        { status: 'pending_review', page: 1, per_page: INBOX_ITEMS_PER_QUEUE }
      )
      contentCounts[path] = page.getMeta().total
      for (const content of page.all()) {
        contentItems.push({
          source: 'content',
          id: content.id,
          kind: path,
          title: content.title,
          establishment_name: content.establishment?.published_revision?.public_name ?? null,
          received_at: content.updated_at?.toISO() ?? null,
          due_at: null,
          overdue: false,
        })
      }
    }

    const reports = await this.reportService.listReportsForModeration(tenantId, actor, {
      status: 'pending',
      page: 1,
      per_page: INBOX_ITEMS_PER_QUEUE,
    })
    const overdueReports = await this.deadlines.countOverdue(tenantId, actor, now)

    const feedback =
      platformAccess === 'platform_admin'
        ? await this.feedbackService.list(tenantId, { status: 'new', page: 1, per_page: 1 }, actor)
        : null

    const inbox: BackofficeInboxItem[] = [
      ...(reports.data as ReportRow[]).map((report): BackofficeInboxItem => ({
        source: 'report',
        id: report.id,
        target_type: report.target_type,
        title: report.target?.title ?? null,
        establishment_name: report.target?.establishment_name ?? null,
        reason: report.reason,
        origin: report.origin,
        is_anonymous: report.is_anonymous,
        received_at: report.created_at,
        due_at: report.due_at,
        overdue: report.due_at !== null && new Date(report.due_at).getTime() < now.getTime(),
      })),
      ...contentItems,
      ...revisions.data.map((revision): BackofficeInboxItem => ({
        source: 'revision',
        id: revision.id,
        public_name: revision.public_name,
        organization_name: revision.organization_name,
        received_at: revision.submitted_at,
        due_at: null,
        overdue: false,
      })),
    ]

    return {
      platform_access: platformAccess,
      counts: {
        revisions: Number(revisions.meta.total),
        content: contentCounts,
        reports: Number(reports.meta.total),
        overdue_reports: overdueReports,
        feedback: feedback ? feedback.getMeta().total : null,
      },
      inbox: inbox.sort(inboxOrder).slice(0, INBOX_SIZE),
    }
  }
}

function timeOf(value: string | null): number {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

function compareTimes(left: number, right: number): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

/** A deadline first, the nearest one first; then whatever has waited longest. */
function inboxOrder(left: BackofficeInboxItem, right: BackofficeInboxItem): number {
  return (
    compareTimes(timeOf(left.due_at), timeOf(right.due_at)) ||
    compareTimes(timeOf(left.received_at), timeOf(right.received_at))
  )
}
