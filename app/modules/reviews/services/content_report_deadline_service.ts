import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'

import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import ContentReportDeadlineRepository, {
  type OverdueReport,
} from '#modules/reviews/repositories/content_report_deadline_repository'
import OverdueReportsNotification from '#modules/reviews/services/overdue_reports_notification'
import type User from '#modules/users/models/user'

/** Sends the notice. A class of its own so a failing transport can be simulated. */
export class OverdueReportsMailer {
  async send(
    recipients: string[],
    operationName: string,
    reports: OverdueReport[],
    now: Date
  ): Promise<void> {
    await mail.send(new OverdueReportsNotification(recipients, operationName, reports, now))
  }
}

export interface OperationNoticeResult {
  tenant_id: number
  /** Reports named in this run's notice; zero when there was nothing to claim. */
  noticed: number
  /** True when overdue reports exist but no one in the operation could act on them. */
  without_recipients: boolean
  /** True when the notice could not be sent; the claim was given back for the next run. */
  failed: boolean
}

export interface OverdueNoticeResult {
  operations: OperationNoticeResult[]
  noticed: number
  failed: number
}

/**
 * Makes a missed moderation deadline observable — ADR-0027.
 *
 * This is observability, not escalation. Continuous human moderation after the
 * delivery is outside the contract (Anexo I item 9), so nothing here reassigns,
 * reminds again or acts on the content: each overdue report is named once, in
 * one message per operation, to the staff who can open that operation's queue.
 *
 * At least once, never twice. The marker is claimed in a short transaction and
 * the mail is sent after it commits, so no row lock is held while a mail server
 * answers. If sending fails, the claim is given back and the next run tries
 * again; if it succeeds, the marker stays and no later run repeats the notice.
 */
@inject()
export default class ContentReportDeadlineService {
  constructor(
    private deadlines: ContentReportDeadlineRepository,
    private mailer: OverdueReportsMailer,
    private organizationPolicy: OrganizationPolicyService
  ) {}

  async notifyOverdue(now: Date = new Date()): Promise<OverdueNoticeResult> {
    const operations: OperationNoticeResult[] = []

    for (const tenant of await this.deadlines.tenantsWithUnnoticedOverdue(now)) {
      const recipients = await this.deadlines.recipients(tenant.id)
      if (recipients.length === 0) {
        // Nobody to tell, so nothing is marked: the marker means "a person was
        // told", and it must stay unset until someone can be.
        operations.push({
          tenant_id: tenant.id,
          noticed: 0,
          without_recipients: true,
          failed: false,
        })
        continue
      }

      const claimed = await db.transaction((client) =>
        this.deadlines.claimOverdue(tenant.id, now, client)
      )
      if (claimed.length === 0) {
        // Another run claimed them between the sweep and the claim.
        operations.push({
          tenant_id: tenant.id,
          noticed: 0,
          without_recipients: false,
          failed: false,
        })
        continue
      }

      try {
        await this.mailer.send(
          recipients.map((recipient) => recipient.email),
          tenant.name,
          claimed,
          now
        )
        operations.push({
          tenant_id: tenant.id,
          noticed: claimed.length,
          without_recipients: false,
          failed: false,
        })
      } catch {
        await this.deadlines.releaseClaim(
          claimed.map((report) => report.id),
          now
        )
        operations.push({
          tenant_id: tenant.id,
          noticed: 0,
          without_recipients: false,
          failed: true,
        })
      }
    }

    return {
      operations,
      noticed: operations.reduce((total, operation) => total + operation.noticed, 0),
      failed: operations.filter((operation) => operation.failed).length,
    }
  }

  /** Every overdue open report of the operation, for the queue's header. */
  async countOverdue(tenantId: number, actor: User, now: Date = new Date()): Promise<number> {
    await this.organizationPolicy.requirePlatformModerator(actor)
    return this.deadlines.countOverdue(tenantId, now)
  }
}
