import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IEstablishmentReview from '#modules/establishments/interfaces/establishment_review_interface'
import EstablishmentRepository from '#modules/establishments/repositories/establishment_repository'
import EstablishmentRevisionEventRepository from '#modules/establishments/repositories/establishment_revision_event_repository'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import EstablishmentRevisionReviewIssueRepository from '#modules/establishments/repositories/establishment_revision_review_issue_repository'
import EstablishmentReviewQueueRepository from '#modules/establishments/repositories/establishment_review_queue_repository'
import EstablishmentRevisionMediaRepository from '#modules/media/repositories/establishment_revision_media_repository'
import EstablishmentAuditService from '#modules/establishments/services/establishment_audit_service'
import EstablishmentPublicationGateService from '#modules/establishments/services/establishment_publication_gate_service'
import EstablishmentReviewIssueService from '#modules/establishments/services/establishment_review_issue_service'
import EstablishmentRevisionEventService from '#modules/establishments/services/establishment_revision_event_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentModerationService {
  constructor(
    private organizationPolicy: OrganizationPolicyService,
    private establishmentRepository: EstablishmentRepository,
    private revisionRepository: EstablishmentRevisionRepository,
    private queueRepository: EstablishmentReviewQueueRepository,
    private mediaRepository: EstablishmentRevisionMediaRepository,
    private eventRepository: EstablishmentRevisionEventRepository,
    private issueRepository: EstablishmentRevisionReviewIssueRepository,
    private issueService: EstablishmentReviewIssueService,
    private eventService: EstablishmentRevisionEventService,
    private publicationGate: EstablishmentPublicationGateService,
    private auditService: EstablishmentAuditService
  ) {}

  async list(tenantId: number, query: IEstablishmentReview.QueueQuery, actor: User) {
    await this.organizationPolicy.requirePlatformModerator(actor)
    const paginator = await this.queueRepository.listPending(tenantId, query)

    return {
      meta: paginator.getMeta(),
      data: paginator.all().map((revision) => ({
        id: revision.id,
        tenant_id: revision.tenant_id,
        establishment_id: revision.establishment_id,
        version: revision.version,
        status: revision.status,
        submitted_at: revision.submitted_at?.toISO() ?? null,
        public_name: revision.public_name,
        city_id: revision.city_id,
        organization_id: revision.establishment.organization_id,
        organization_name:
          revision.establishment.organization.trade_name ||
          revision.establishment.organization.legal_name,
      })),
    }
  }

  async show(tenantId: number, revisionId: number, actor: User) {
    await this.organizationPolicy.requirePlatformModerator(actor)
    const revision = await this.revisionRepository.findAggregate(tenantId, revisionId)

    if (!revision) {
      throw new NotFoundException('Establishment revision not found')
    }

    const issues = await this.issueRepository.listForRevision(
      tenantId,
      revision.establishment_id,
      revision.id
    )
    const events = await this.eventRepository.listForRevision(
      tenantId,
      revision.establishment_id,
      revision.id
    )
    const gate = await this.publicationGate.check(
      tenantId,
      revision.establishment_id,
      revision.id,
      actor
    )

    return {
      revision: this.projectRevision(revision),
      publication_gate: gate,
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

  async requestChanges(
    tenantId: number,
    revisionId: number,
    actor: User,
    payload: IEstablishmentReview.RequestChangesPayload
  ) {
    await this.organizationPolicy.requirePlatformModerator(actor)
    const reason = this.requireReason(payload.reason)
    const preview = await this.requireRevisionPreview(tenantId, revisionId)

    const result = await db.transaction(async (client) => {
      const establishment = await this.lockEstablishment(tenantId, preview.establishment_id, client)
      const revision = await this.requirePendingRevision(tenantId, revisionId, client)
      if (revision.establishment_id !== establishment.id) {
        throw new NotFoundException('Establishment revision not found')
      }
      const previousStatus = revision.status

      await this.issueService.replaceOpen(revision, actor.id, payload.issues, client)

      revision.status = 'changes_requested'
      revision.reviewed_by = actor.id
      revision.reviewed_at = DateTime.now()
      revision.review_notes = reason
      await revision.save()

      await this.eventService.record(
        revision,
        'changes_requested',
        actor.id,
        previousStatus,
        'changes_requested',
        reason,
        {
          issue_codes: payload.issues.map((issue) => issue.code),
          blocking_issue_count: payload.issues.filter((issue) => issue.severity === 'blocking')
            .length,
        },
        client
      )

      return this.projectRevision(revision)
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'request_changes',
      resourceId: result.establishment_id,
      metadata: {
        tenant_id: tenantId,
        establishment_id: result.establishment_id,
        revision_id: result.id,
        revision_version: result.version,
        issue_count: payload.issues.length,
      },
    })

    return result
  }

  async reject(tenantId: number, revisionId: number, actor: User, reasonInput: string) {
    await this.organizationPolicy.requirePlatformModerator(actor)
    const reason = this.requireReason(reasonInput)
    const preview = await this.requireRevisionPreview(tenantId, revisionId)

    const result = await db.transaction(async (client) => {
      const establishment = await this.lockEstablishment(tenantId, preview.establishment_id, client)
      const revision = await this.requirePendingRevision(tenantId, revisionId, client)
      if (revision.establishment_id !== establishment.id) {
        throw new NotFoundException('Establishment revision not found')
      }
      const previousStatus = revision.status

      await this.issueService.resolveOpen(revision, actor.id, client)

      revision.status = 'rejected'
      revision.reviewed_by = actor.id
      revision.reviewed_at = DateTime.now()
      revision.review_notes = reason
      await revision.save()

      await this.eventService.record(
        revision,
        'rejected',
        actor.id,
        previousStatus,
        'rejected',
        reason,
        null,
        client
      )

      return this.projectRevision(revision)
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'reject',
      resourceId: result.establishment_id,
      metadata: {
        tenant_id: tenantId,
        establishment_id: result.establishment_id,
        revision_id: result.id,
        revision_version: result.version,
      },
    })

    return result
  }

  async approve(tenantId: number, revisionId: number, actor: User, reasonInput?: string | null) {
    await this.organizationPolicy.requirePlatformModerator(actor)
    const reason = this.normalizeReason(reasonInput)
    const preview = await this.requireRevisionPreview(tenantId, revisionId)

    const result = await db.transaction(async (client) => {
      const establishment = await this.lockEstablishment(tenantId, preview.establishment_id, client)
      const revision = await this.requirePendingRevision(tenantId, revisionId, client)
      if (revision.establishment_id !== establishment.id) {
        throw new NotFoundException('Establishment revision not found')
      }
      await this.mediaRepository.lockForRevision(tenantId, establishment.id, revision.id, client)
      const gate = await this.publicationGate.check(
        tenantId,
        establishment.id,
        revision.id,
        actor,
        client
      )

      if (!gate.eligible) {
        return {
          approved: false,
          revision: this.projectRevision(revision),
          publication_gate: gate,
        }
      }

      const previousStatus = revision.status
      await this.issueService.resolveOpen(revision, actor.id, client)

      revision.status = 'approved'
      revision.reviewed_by = actor.id
      revision.reviewed_at = DateTime.now()
      revision.review_notes = reason
      await revision.save()

      establishment.published_revision_id = revision.id
      await establishment.save()

      await this.eventService.record(
        revision,
        'approved',
        actor.id,
        previousStatus,
        'approved',
        reason,
        { rules_version: gate.rules_version, score: gate.score },
        client
      )
      await this.eventService.record(
        revision,
        'published',
        actor.id,
        'approved',
        'approved',
        null,
        { published_revision_id: revision.id },
        client
      )

      return {
        approved: true,
        revision: this.projectRevision(revision),
        publication_gate: gate,
      }
    })

    if (result.approved) {
      await this.auditService.log({
        actorId: actor.id,
        action: 'approve',
        resourceId: result.revision.establishment_id,
        metadata: {
          tenant_id: tenantId,
          establishment_id: result.revision.establishment_id,
          revision_id: result.revision.id,
          revision_version: result.revision.version,
          published_revision_id: result.revision.id,
          rules_version: result.publication_gate.rules_version,
        },
      })
    }

    return result
  }

  private async requireRevisionPreview(tenantId: number, revisionId: number) {
    const revision = await this.revisionRepository.findByIdForTenant(tenantId, revisionId)
    if (!revision) {
      throw new NotFoundException('Establishment revision not found')
    }
    return revision
  }

  private async requirePendingRevision(
    tenantId: number,
    revisionId: number,
    client: Parameters<EstablishmentRevisionRepository['findLocked']>[2]
  ) {
    const revision = await this.revisionRepository.findLocked(tenantId, revisionId, client)
    if (!revision) {
      throw new NotFoundException('Establishment revision not found')
    }
    if (revision.status !== 'pending_review') {
      throw new BadRequestException(
        `Only pending_review revisions can be moderated; current status is ${revision.status}`
      )
    }
    return revision
  }

  private async lockEstablishment(
    tenantId: number,
    establishmentId: number,
    client: Parameters<EstablishmentRepository['findLocked']>[2]
  ) {
    const establishment = await this.establishmentRepository.findLocked(
      tenantId,
      establishmentId,
      client
    )
    if (!establishment) {
      throw new NotFoundException('Establishment not found')
    }
    if (establishment.lifecycle_status !== 'active') {
      throw new BadRequestException('Only active establishments can be moderated')
    }
    return establishment
  }

  private projectRevision(revision: {
    id: number
    tenant_id: number
    establishment_id: number
    version: number
    status: string
    public_name: string | null
    slug: string | null
    submitted_at: DateTime | null
    reviewed_by: number | null
    reviewed_at: DateTime | null
    review_notes: string | null
  }) {
    return {
      id: revision.id,
      tenant_id: revision.tenant_id,
      establishment_id: revision.establishment_id,
      version: revision.version,
      status: revision.status,
      public_name: revision.public_name,
      slug: revision.slug,
      submitted_at: revision.submitted_at?.toISO() ?? null,
      reviewed_by: revision.reviewed_by,
      reviewed_at: revision.reviewed_at?.toISO() ?? null,
      review_notes: revision.review_notes,
    }
  }

  private requireReason(value: string): string {
    const normalized = this.normalizeReason(value)
    if (!normalized) {
      throw new BadRequestException('A moderation reason is required')
    }
    return normalized
  }

  private normalizeReason(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? ''
    return normalized.length > 0 ? normalized : null
  }
}
