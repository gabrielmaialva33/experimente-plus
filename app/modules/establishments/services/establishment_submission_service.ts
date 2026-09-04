import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import EstablishmentRevisionEventRepository from '#modules/establishments/repositories/establishment_revision_event_repository'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import EstablishmentRevisionReviewIssueRepository from '#modules/establishments/repositories/establishment_revision_review_issue_repository'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import EstablishmentAuditService from '#modules/establishments/services/establishment_audit_service'
import EstablishmentCompletenessService from '#modules/establishments/services/establishment_completeness_service'
import EstablishmentReviewIssueService from '#modules/establishments/services/establishment_review_issue_service'
import EstablishmentRevisionEventService from '#modules/establishments/services/establishment_revision_event_service'
import type User from '#modules/users/models/user'

export interface EstablishmentSubmissionResult {
  submitted: boolean
  revision: {
    id: number
    establishment_id: number
    version: number
    status: IEstablishment.RevisionStatus
    submitted_at: string | null
    reviewed_at: string | null
    review_notes: string | null
  }
  gate: IEstablishment.CompletenessResult
}

@inject()
export default class EstablishmentSubmissionService {
  constructor(
    private accessService: EstablishmentAccessService,
    private revisionRepository: EstablishmentRevisionRepository,
    private eventRepository: EstablishmentRevisionEventRepository,
    private issueRepository: EstablishmentRevisionReviewIssueRepository,
    private completenessService: EstablishmentCompletenessService,
    private issueService: EstablishmentReviewIssueService,
    private eventService: EstablishmentRevisionEventService,
    private auditService: EstablishmentAuditService
  ) {}

  async status(tenantId: number, establishmentId: number, actor: User) {
    const establishment = await this.accessService.getReadable(tenantId, establishmentId, actor)
    const revision = await this.revisionRepository.findCurrentForEstablishment(
      tenantId,
      establishment.id,
      establishment.published_revision_id
    )

    if (!revision) {
      return {
        establishment_id: establishment.id,
        revision: null,
        gate: null,
        review_issues: [],
        events: [],
      }
    }

    const gate = await this.completenessService.check(tenantId, establishmentId, actor, revision.id)
    const issues = await this.issueRepository.listForRevision(
      tenantId,
      establishmentId,
      revision.id
    )
    const events = await this.eventRepository.listForRevision(
      tenantId,
      establishmentId,
      revision.id
    )

    return {
      establishment_id: establishment.id,
      revision: this.projectRevision(revision),
      gate,
      review_issues: issues.map((issue) => ({
        id: issue.id,
        code: issue.code,
        field: issue.field,
        message: issue.message,
        severity: issue.severity,
        created_at: issue.created_at.toISO(),
        resolved_at: issue.resolved_at?.toISO() ?? null,
      })),
      events: events.map((event) => ({
        id: event.id,
        event_type: event.event_type,
        from_status: event.from_status,
        to_status: event.to_status,
        reason: event.reason,
        created_at: event.created_at.toISO(),
      })),
    }
  }

  async submit(
    tenantId: number,
    establishmentId: number,
    actor: User
  ): Promise<EstablishmentSubmissionResult> {
    const result = await db.transaction(async (client) => {
      const { establishment, revision } = await this.accessService.getEditable(
        tenantId,
        establishmentId,
        actor,
        client
      )
      const gate = await this.completenessService.check(
        tenantId,
        establishmentId,
        actor,
        revision.id,
        client
      )
      const additionalIssues: IEstablishment.CompletenessIssue[] = []

      if (establishment.lifecycle_status !== 'active') {
        additionalIssues.push({
          code: 'establishment_not_active',
          field: 'lifecycle_status',
          message: 'The establishment must be active before submission',
          severity: 'blocking',
        })
      }

      if (establishment.business_status === 'permanently_closed') {
        additionalIssues.push({
          code: 'establishment_permanently_closed',
          field: 'business_status',
          message: 'A permanently closed establishment cannot be submitted',
          severity: 'blocking',
        })
      }

      const blocking = this.deduplicateIssues([...gate.blocking_issues, ...additionalIssues])
      const submissionGate: IEstablishment.CompletenessResult = {
        ...gate,
        eligible: blocking.length === 0,
        score: blocking.length === 0 ? gate.score : Math.min(gate.score, 99),
        blocking_issues: blocking,
      }

      if (!submissionGate.eligible) {
        return {
          submitted: false,
          revision: this.projectRevision(revision),
          gate: submissionGate,
        }
      }

      const previousStatus = revision.status
      await this.issueService.resolveOpen(revision, actor.id, client)

      revision.status = 'pending_review'
      revision.submitted_at = DateTime.now()
      revision.reviewed_by = null
      revision.reviewed_at = null
      revision.review_notes = null
      await revision.save()

      await this.eventService.record(
        revision,
        previousStatus === 'changes_requested' ? 'resubmitted' : 'submitted',
        actor.id,
        previousStatus,
        'pending_review',
        null,
        {
          score: submissionGate.score,
          rules_version: submissionGate.rules_version,
          blocking_issue_codes: [],
          warning_codes: submissionGate.warnings.map((warning) => warning.code),
        },
        client
      )

      return {
        submitted: true,
        revision: this.projectRevision(revision),
        gate: submissionGate,
      }
    })

    if (result.submitted) {
      await this.auditService.log({
        actorId: actor.id,
        action: 'submit',
        resourceId: establishmentId,
        metadata: {
          tenant_id: tenantId,
          establishment_id: establishmentId,
          revision_id: result.revision.id,
          revision_version: result.revision.version,
          rules_version: result.gate.rules_version,
        },
      })
    }

    return result
  }

  private projectRevision(revision: {
    id: number
    establishment_id: number
    version: number
    status: IEstablishment.RevisionStatus
    submitted_at: DateTime | null
    reviewed_at: DateTime | null
    review_notes: string | null
  }) {
    return {
      id: revision.id,
      establishment_id: revision.establishment_id,
      version: revision.version,
      status: revision.status,
      submitted_at: revision.submitted_at?.toISO() ?? null,
      reviewed_at: revision.reviewed_at?.toISO() ?? null,
      review_notes: revision.review_notes,
    }
  }

  private deduplicateIssues(
    issues: IEstablishment.CompletenessIssue[]
  ): IEstablishment.CompletenessIssue[] {
    const byKey = new Map<string, IEstablishment.CompletenessIssue>()
    for (const issue of issues) {
      byKey.set(`${issue.code}:${issue.field}`, issue)
    }
    return [...byKey.values()]
  }
}
