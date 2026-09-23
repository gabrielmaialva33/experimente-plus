import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import NotFoundException from '#exceptions/not_found_exception'
import { DuplicateReportException } from '#modules/reviews/exceptions'
import type IReview from '#modules/reviews/interfaces/review_interface'
import type ContentReport from '#modules/reviews/models/content_report'
import ContentReportRepository from '#modules/reviews/repositories/content_report_repository'
import PublicReportTargetRepository from '#modules/reviews/repositories/public_report_target_repository'
import ReviewPolicyRepository from '#modules/reviews/repositories/review_policy_repository'
import ReportOriginHasher from '#modules/reviews/services/report_origin_hasher'
import { buildProtocolNumber } from '#modules/reviews/services/report_protocol'

/**
 * Anonymous reports — ADR-0027 scenarios 13 and 14.
 *
 * The contract lists a report flow without qualifying it, and requiring an
 * account suppresses precisely the report that matters most: the one whose
 * author does not want to be known to the establishment or to the operation.
 * The report enters the same single queue as every other, with no author, and
 * the person is recorded only as two keyed hashes whose sole purpose is to
 * recognise the same person reporting the same thing again.
 */
@inject()
export default class AnonymousReportService {
  constructor(
    private reports: ContentReportRepository,
    private targets: PublicReportTargetRepository,
    private policies: ReviewPolicyRepository,
    private hasher: ReportOriginHasher
  ) {}

  async create(
    tenantId: number,
    payload: IReview.CreateReportPayload,
    origin: { ip: string; token: string | null }
  ): Promise<ContentReport> {
    const ipHash = this.hasher.hash(
      'ip',
      tenantId,
      payload.target_type,
      payload.target_id,
      origin.ip
    )
    const tokenHash = origin.token
      ? this.hasher.hash('token', tenantId, payload.target_type, payload.target_id, origin.token)
      : null

    try {
      return await db.transaction(async (client) => {
        const visible = await this.targets.isVisible(
          tenantId,
          payload.target_type,
          payload.target_id,
          client
        )
        if (!visible) throw new NotFoundException('Report target not found')

        const repeat = await this.reports.findAnonymousRepeat(
          tenantId,
          payload.target_type,
          payload.target_id,
          ipHash,
          tokenHash,
          client
        )
        // Answered like any duplicate, and with nothing about the earlier
        // report: not its protocol, not its status, not when.
        if (repeat) throw new DuplicateReportException('This content was already reported')

        const policy = await this.policies.getForTenant(tenantId, client)

        return this.reports.create(
          {
            tenant_id: tenantId,
            protocol_number: buildProtocolNumber(),
            target_type: payload.target_type,
            target_id: payload.target_id,
            reporter_id: null,
            is_anonymous: true,
            reporter_ip_hash: ipHash,
            reporter_token_hash: tokenHash,
            reason: payload.reason,
            details: payload.details?.trim() || null,
            status: 'pending',
            assigned_to: null,
            due_at: DateTime.now().plus({ days: policy.report_moderation_days }),
            sla_notified_at: null,
            resolved_by: null,
            resolved_at: null,
            resolution_action: null,
            resolution_notes: null,
            origin: 'user',
            automatic_rule: null,
            automatic_evidence: null,
            holds_content: false,
          },
          { client }
        )
      })
    } catch (error) {
      // Two submissions racing past the lookup meet in the unique indexes on
      // the hashes; the loser is a repeat, not a server error.
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new DuplicateReportException('This content was already reported')
      }
      throw error
    }
  }
}
