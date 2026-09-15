import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import Establishment from '#modules/establishments/models/establishment'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type IReview from '#modules/reviews/interfaces/review_interface'
import type ContentReport from '#modules/reviews/models/content_report'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import ContentReportRepository from '#modules/reviews/repositories/content_report_repository'
import type User from '#modules/users/models/user'

@inject()
export default class ContentReportService {
  constructor(
    private reportRepository: ContentReportRepository,
    private organizationPolicy: OrganizationPolicyService
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
        throw new BadRequestException('You have already reported this content')
      }

      const report = await this.reportRepository.create(
        {
          tenant_id: tenantId,
          target_type: payload.target_type,
          target_id: payload.target_id,
          reporter_id: actor.id,
          reason: payload.reason,
          details: payload.details?.trim() || null,
          status: 'pending',
          resolved_by: null,
          resolved_at: null,
          resolution_action: null,
          resolution_notes: null,
        },
        { client }
      )

      return report
    })
  }

  async listReports(
    tenantId: number,
    actor: User,
    query: IReview.ListReportsQuery
  ) {
    await this.organizationPolicy.requirePlatformModerator(actor)
    return this.reportRepository.paginateForTenant(tenantId, query)
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
        await this.hideTargetContent(tenantId, report.target_type, report.target_id, client)
      }

      return report
    })
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
    }
  }

  private async hideTargetContent(
    tenantId: number,
    targetType: IReview.ReportTargetType,
    targetId: number,
    client: any
  ): Promise<void> {
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
