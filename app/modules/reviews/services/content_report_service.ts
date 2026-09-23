import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import NotFoundException from '#exceptions/not_found_exception'
import { DuplicateReportException } from '#modules/reviews/exceptions'
import Establishment from '#modules/establishments/models/establishment'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import { discoverableEstablishmentExistsSql } from '#modules/catalog/repositories/catalog_discoverability'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import IReview from '#modules/reviews/interfaces/review_interface'
import type ContentReport from '#modules/reviews/models/content_report'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import ContentReportRepository from '#modules/reviews/repositories/content_report_repository'
import ContentReportTargetRepository from '#modules/reviews/repositories/content_report_target_repository'
import ReviewPolicyRepository from '#modules/reviews/repositories/review_policy_repository'
import { buildProtocolNumber } from '#modules/reviews/services/report_protocol'
import type User from '#modules/users/models/user'

@inject()
export default class ContentReportService {
  constructor(
    private reportRepository: ContentReportRepository,
    private targetRepository: ContentReportTargetRepository,
    private policyRepository: ReviewPolicyRepository,
    private organizationPolicy: OrganizationPolicyService,
    private partnerContent: PartnerContentService
  ) {}

  async createReport(
    tenantId: number,
    actor: User,
    payload: IReview.CreateReportPayload
  ): Promise<ContentReport> {
    return db.transaction(async (client) => {
      await this.validateTargetExists(tenantId, payload.target_type, payload.target_id, client)

      const existing = await this.reportRepository.findByTargetAndReporter(
        tenantId,
        payload.target_type,
        payload.target_id,
        actor.id,
        client
      )

      if (existing) {
        throw new DuplicateReportException('You have already reported this content')
      }

      const policy = await this.policyRepository.getForTenant(tenantId, client)

      const report = await this.reportRepository.create(
        {
          tenant_id: tenantId,
          protocol_number: buildProtocolNumber(),
          target_type: payload.target_type,
          target_id: payload.target_id,
          reporter_id: actor.id,
          is_anonymous: false,
          reporter_ip_hash: null,
          reporter_token_hash: null,
          reason: payload.reason,
          details: payload.details?.trim() || null,
          status: 'pending',
          assigned_to: null,
          // The deadline comes from the tenant's policy, never a constant: it is
          // one of the values the contracting party has yet to settle.
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

      return report
    })
  }

  async listReports(tenantId: number, actor: User, query: IReview.ListReportsQuery) {
    await this.organizationPolicy.requirePlatformModerator(actor)
    return this.reportRepository.paginateForTenant(tenantId, query)
  }

  /**
   * The same queue, with the reported content resolved beside each report.
   *
   * It exists separately from `listReports` because the JSON contract of
   * `/api/v1/admin/content-reports` is published and pinned by a parity test,
   * and widening it to serve one screen would make every consumer pay for a
   * join it did not ask for. The screen needs the text; the API does not have
   * to grow to say so.
   */
  async listReportsForModeration(
    tenantId: number,
    actor: User,
    query: IReview.ListReportsQuery
  ): Promise<{
    meta: Record<string, unknown>
    data: Array<Record<string, unknown>>
  }> {
    const page = await this.listReports(tenantId, actor, query)
    const reports = page.all()
    const targets = await this.targetRepository.projectFor(tenantId, reports)

    return {
      meta: page.getMeta(),
      data: reports.map((report) => ({
        ...report.serialize(),
        // `serialize()` honours the model: the origin hashes are never
        // serialised, and the reporter arrives only through the preloaded
        // relation below, narrowed to what a queue has to show.
        reporter: report.reporter
          ? { id: report.reporter.id, full_name: report.reporter.full_name }
          : null,
        resolver: report.resolver
          ? { id: report.resolver.id, full_name: report.resolver.full_name }
          : null,
        target: targets.get(report.id) ?? null,
      })),
    }
  }

  async resolveReport(
    tenantId: number,
    id: number,
    actor: User,
    payload: IReview.ResolveReportPayload
  ): Promise<ContentReport> {
    await this.organizationPolicy.requirePlatformModerator(actor)

    return db.transaction(async (client) => {
      const report = await this.reportRepository.findById(tenantId, id, client, true)
      if (!report) {
        throw new NotFoundException('Content report not found')
      }

      report.useTransaction(client)
      report.status = payload.status
      report.resolved_by = actor.id
      report.resolved_at = DateTime.utc()
      report.resolution_action = payload.resolution_action?.trim() || null
      report.resolution_notes = payload.resolution_notes?.trim() || null
      await report.save()

      if (payload.resolution_action === 'content_hidden') {
        await this.hideTargetContent(tenantId, report.target_type, report.target_id, actor, client)
      } else if (report.origin === 'automatic' && report.holds_content) {
        await this.releaseAutomaticHold(tenantId, report, client)
      }

      return report
    })
  }

  /**
   * A person decided a rule's report without hiding the content: release what
   * the rule held — ADR-0031.
   *
   * Only what the rule held. If any other report of the same target was
   * resolved with `content_hidden`, a moderator hid it on its merits and it
   * stays hidden; the rule's dismissal is not a reason to republish it.
   */
  private async releaseAutomaticHold(
    tenantId: number,
    report: ContentReport,
    client: any
  ): Promise<void> {
    const hiddenByPerson = await client
      .from('content_reports')
      .where('tenant_id', tenantId)
      .where('target_type', report.target_type)
      .where('target_id', report.target_id)
      .whereNot('id', report.id)
      .where('resolution_action', 'content_hidden')
      .first()
    if (hiddenByPerson) return

    if (IReview.isPartnerContentTarget(report.target_type)) {
      await this.partnerContent.releaseHold(report.target_type, tenantId, report.target_id, client)
      return
    }

    const model =
      report.target_type === 'review'
        ? EstablishmentReview
        : report.target_type === 'reply'
          ? EstablishmentReviewReply
          : null
    if (!model) return

    await model
      .query({ client })
      .where('tenant_id', tenantId)
      .where('id', report.target_id)
      .where('status', 'hidden')
      .update({ status: 'published', updated_at: new Date() })
  }

  private async validateTargetExists(
    tenantId: number,
    targetType: IReview.ReportTargetType,
    targetId: number,
    client: any
  ): Promise<void> {
    if (targetType === 'review') {
      const target = await EstablishmentReview.query({ client })
        .where('tenant_id', tenantId)
        .where('id', targetId)
        .first()
      if (!target) throw new NotFoundException('Report target review not found')
    } else if (targetType === 'reply') {
      const target = await EstablishmentReviewReply.query({ client })
        .where('tenant_id', tenantId)
        .where('id', targetId)
        .first()
      if (!target) throw new NotFoundException('Report target reply not found')
    } else if (targetType === 'establishment') {
      const target = await Establishment.query({ client })
        .where('tenant_id', tenantId)
        .where('id', targetId)
        .first()
      if (!target) throw new NotFoundException('Report target establishment not found')
    } else if (IReview.isPartnerContentTarget(targetType)) {
      await this.requireVisiblePartnerContent(tenantId, targetType, targetId, client)
    }
  }

  /**
   * Partner content is reportable only as the public sees it.
   *
   * A report is about something someone read. A draft, an item waiting for
   * approval, an archived one, or content of an establishment that is not
   * discoverable was never in front of the reporter, and accepting a report of
   * it by id would turn the endpoint into a way of asking which identifiers
   * exist behind the public surface.
   */
  private async requireVisiblePartnerContent(
    tenantId: number,
    kind: IReview.PartnerContentTarget,
    id: number,
    client: any
  ): Promise<void> {
    const table = {
      experience: 'establishment_experiences',
      event: 'establishment_events',
      showcase_item: 'establishment_showcase_items',
    }[kind]

    const result = await client.rawQuery(
      `
      SELECT EXISTS (
        SELECT 1
          FROM ${table} content
         WHERE content.tenant_id = ?
           AND content.id = ?
           AND content.published_snapshot IS NOT NULL
           AND content.status <> 'archived'
           AND EXISTS (${discoverableEstablishmentExistsSql.replace('AND projection.establishment_id = ?', 'AND projection.establishment_id = content.establishment_id')})
      ) AS visible
      `,
      [tenantId, id, tenantId]
    )

    if (result.rows[0]?.visible !== true) {
      throw new NotFoundException('Report target not found')
    }
  }

  private async hideTargetContent(
    tenantId: number,
    targetType: IReview.ReportTargetType,
    targetId: number,
    actor: User,
    client: any
  ): Promise<void> {
    // Partner content is hidden by archiving it, which is what ADR-0028 §4 says
    // deactivating means. It goes through the partner-content service rather
    // than an update here, so the archive author, the timestamp and the
    // projection version move exactly as they do from the moderation screen.
    if (IReview.isPartnerContentTarget(targetType)) {
      await this.partnerContent.archive(targetType, tenantId, targetId, actor, {
        asModerator: true,
        client,
      })
      return
    }

    if (targetType === 'review') {
      await EstablishmentReview.query({ client })
        .where('tenant_id', tenantId)
        .where('id', targetId)
        .update({ status: 'hidden' })
    } else if (targetType === 'reply') {
      await EstablishmentReviewReply.query({ client })
        .where('tenant_id', tenantId)
        .where('id', targetId)
        .update({ status: 'hidden' })
    }
  }
}
