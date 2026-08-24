import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import type IEstablishmentReview from '#modules/establishments/interfaces/establishment_review_interface'
import type EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionReviewIssueRepository from '#modules/establishments/repositories/establishment_revision_review_issue_repository'

@inject()
export default class EstablishmentReviewIssueService {
  constructor(private issueRepository: EstablishmentRevisionReviewIssueRepository) {}

  async replaceOpen(
    revision: EstablishmentRevision,
    actorId: number,
    issues: IEstablishmentReview.IssuePayload[],
    client: TransactionClientContract
  ): Promise<void> {
    if (issues.length === 0) {
      throw new BadRequestException('At least one review issue is required')
    }

    const keys = issues.map((issue) => `${issue.code}:${issue.field}`)
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Review issue code and field pairs must be unique')
    }

    await this.issueRepository.resolveOpen(
      revision.tenant_id,
      revision.establishment_id,
      revision.id,
      actorId,
      client
    )

    for (const issue of issues) {
      await this.issueRepository.create(
        {
          tenant_id: revision.tenant_id,
          establishment_id: revision.establishment_id,
          revision_id: revision.id,
          code: issue.code,
          field: issue.field,
          message: issue.message,
          severity: issue.severity,
          created_by: actorId,
          resolved_by: null,
          resolved_at: null,
        },
        { client }
      )
    }
  }

  async resolveOpen(
    revision: EstablishmentRevision,
    actorId: number,
    client: TransactionClientContract
  ): Promise<number> {
    return this.issueRepository.resolveOpen(
      revision.tenant_id,
      revision.establishment_id,
      revision.id,
      actorId,
      client
    )
  }
}
