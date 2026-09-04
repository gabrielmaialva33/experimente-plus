import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import NotFoundException from '#exceptions/not_found_exception'
import type IEstablishmentReview from '#modules/establishments/interfaces/establishment_review_interface'
import EstablishmentRepository from '#modules/establishments/repositories/establishment_repository'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import EstablishmentRevisionReviewIssueRepository from '#modules/establishments/repositories/establishment_revision_review_issue_repository'
import EstablishmentCompletenessService from '#modules/establishments/services/establishment_completeness_service'
import {
  ESTABLISHMENT_SLUG_ALREADY_PUBLISHED_CODE,
  establishmentSlugAlreadyPublishedIssue,
} from '#modules/establishments/services/establishment_completeness_evaluator'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentPublicationGateService {
  constructor(
    private establishmentRepository: EstablishmentRepository,
    private revisionRepository: EstablishmentRevisionRepository,
    private issueRepository: EstablishmentRevisionReviewIssueRepository,
    private completenessService: EstablishmentCompletenessService
  ) {}

  async check(
    tenantId: number,
    establishmentId: number,
    revisionId: number,
    actor: User,
    client?: TransactionClientContract
  ): Promise<IEstablishmentReview.GateResult> {
    const establishment = client
      ? await this.establishmentRepository.findLocked(tenantId, establishmentId, client)
      : await this.establishmentRepository.findByIdForTenant(tenantId, establishmentId)

    if (!establishment) {
      throw new NotFoundException('Establishment not found')
    }

    const revision = await this.revisionRepository.findAggregate(tenantId, revisionId, client)
    if (!revision || revision.establishment_id !== establishmentId) {
      throw new NotFoundException('Establishment revision not found')
    }

    const completeness = await this.completenessService.check(
      tenantId,
      establishmentId,
      actor,
      revisionId,
      client
    )
    const blocking: IEstablishmentReview.GateIssue[] = completeness.blocking_issues
      .filter((issue) => issue.code !== ESTABLISHMENT_SLUG_ALREADY_PUBLISHED_CODE)
      .map((issue) => ({
        code: issue.code,
        field: issue.field,
        message: issue.message,
        severity: 'blocking',
        metadata: issue.metadata,
      }))
    const warnings: IEstablishmentReview.GateIssue[] = completeness.warnings.map((issue) => ({
      code: issue.code,
      field: issue.field,
      message: issue.message,
      severity: issue.severity === 'warning' ? 'warning' : 'blocking',
      metadata: issue.metadata,
    }))

    if (revision.slug) {
      if (client) {
        await this.revisionRepository.lockSlugForPublication(
          tenantId,
          revision.city_id,
          revision.slug,
          client
        )
      }

      const slugAlreadyPublished = await this.revisionRepository.isPublishedSlugTaken(
        tenantId,
        revision.city_id,
        revision.slug,
        establishment.id,
        client
      )
      if (slugAlreadyPublished) {
        blocking.push(establishmentSlugAlreadyPublishedIssue(revision.city_id, revision.slug))
      }
    }

    const latitude = revision.address?.latitude
    const longitude = revision.address?.longitude
    if (
      latitude === null ||
      latitude === undefined ||
      longitude === null ||
      longitude === undefined
    ) {
      blocking.push(
        this.issue(
          'coordinates_missing',
          'address.coordinates',
          'Public coordinates are required before publication'
        )
      )
    }

    const approvedCover = revision.media.filter(
      (item) => item.is_cover && item.moderation_status === 'approved'
    )
    if (approvedCover.length !== 1) {
      blocking.push(
        this.issue(
          'approved_cover_missing',
          'media.cover',
          'Exactly one approved cover image is required before publication',
          { approved_cover_count: approvedCover.length }
        )
      )
    }

    const pendingMedia = revision.media.filter((item) => item.moderation_status === 'pending')
    if (pendingMedia.length > 0) {
      blocking.push(
        this.issue('media_pending', 'media', 'All media must be reviewed before publication', {
          media_ids: pendingMedia.map((item) => item.id),
        })
      )
    }

    const quarantinedMedia = revision.media.filter(
      (item) => item.moderation_status === 'quarantined'
    )
    if (quarantinedMedia.length > 0) {
      blocking.push(
        this.issue(
          'media_quarantined',
          'media',
          'Quarantined media must be removed before publication',
          { media_ids: quarantinedMedia.map((item) => item.id) }
        )
      )
    }

    const openBlockingIssues = await this.issueRepository.countOpenBlocking(
      tenantId,
      establishmentId,
      revisionId,
      client
    )
    if (openBlockingIssues > 0) {
      blocking.push(
        this.issue(
          'review_issues_open',
          'review_issues',
          'Blocking review issues must be resolved before publication',
          { open_blocking_issues: openBlockingIssues }
        )
      )
    }

    return {
      eligible: blocking.length === 0,
      score: blocking.length === 0 ? 100 : Math.min(completeness.score, 99),
      blocking_issues: this.deduplicate(blocking),
      warnings: this.deduplicate(warnings),
      checked_at: DateTime.utc().toISO() ?? '',
      rules_version: revision.rules_version,
    }
  }

  private issue(
    code: string,
    field: string,
    message: string,
    metadata?: Record<string, unknown>
  ): IEstablishmentReview.GateIssue {
    return { code, field, message, severity: 'blocking', metadata }
  }

  private deduplicate(issues: IEstablishmentReview.GateIssue[]): IEstablishmentReview.GateIssue[] {
    const byKey = new Map<string, IEstablishmentReview.GateIssue>()
    for (const issue of issues) {
      byKey.set(`${issue.code}:${issue.field}`, issue)
    }
    return [...byKey.values()]
  }
}
