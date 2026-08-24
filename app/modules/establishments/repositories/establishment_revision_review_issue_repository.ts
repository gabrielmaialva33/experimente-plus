import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import EstablishmentRevisionReviewIssue from '#modules/establishments/models/establishment_revision_review_issue'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class EstablishmentRevisionReviewIssueRepository extends LucidRepository<
  typeof EstablishmentRevisionReviewIssue
> {
  constructor() {
    super(EstablishmentRevisionReviewIssue)
  }

  async listForRevision(
    tenantId: number,
    establishmentId: number,
    revisionId: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentRevisionReviewIssue[]> {
    const query = client
      ? EstablishmentRevisionReviewIssue.query({ client })
      : EstablishmentRevisionReviewIssue.query()

    return query
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('revision_id', revisionId)
      .orderByRaw('resolved_at IS NULL DESC')
      .orderBy('severity', 'asc')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
  }

  async listOpen(
    tenantId: number,
    establishmentId: number,
    revisionId: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentRevisionReviewIssue[]> {
    const query = client
      ? EstablishmentRevisionReviewIssue.query({ client })
      : EstablishmentRevisionReviewIssue.query()

    return query
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('revision_id', revisionId)
      .whereNull('resolved_at')
      .orderBy('severity', 'asc')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
  }

  async countOpenBlocking(
    tenantId: number,
    establishmentId: number,
    revisionId: number,
    client?: TransactionClientContract
  ): Promise<number> {
    const query = client
      ? EstablishmentRevisionReviewIssue.query({ client })
      : EstablishmentRevisionReviewIssue.query()
    const row = await query
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('revision_id', revisionId)
      .where('severity', 'blocking')
      .whereNull('resolved_at')
      .count('* as total')
      .first()

    return Number(row?.$extras.total ?? 0)
  }

  async resolveOpen(
    tenantId: number,
    establishmentId: number,
    revisionId: number,
    actorId: number,
    client: TransactionClientContract
  ): Promise<number> {
    const updated = await EstablishmentRevisionReviewIssue.query({ client })
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('revision_id', revisionId)
      .whereNull('resolved_at')
      .update({
        resolved_by: actorId,
        resolved_at: DateTime.now().toSQL(),
      })

    return Number(updated)
  }
}
