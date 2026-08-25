import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import AuditService from '#modules/audits/services/audit_service'
import Establishment from '#modules/establishments/models/establishment'
import Organization from '#modules/organizations/models/organization'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type IPilotFeedback from '#modules/pilot_feedback/interfaces/pilot_feedback_interface'
import PilotFeedbackRepository from '#modules/pilot_feedback/repositories/pilot_feedback_repository'
import type User from '#modules/users/models/user'

interface ResolvedTarget {
  organizationId: number | null
  establishmentId: number | null
}

@inject()
export default class PilotFeedbackService {
  constructor(
    private feedbackRepository: PilotFeedbackRepository,
    private organizationPolicy: OrganizationPolicyService,
    private auditService: AuditService
  ) {}

  async create(tenantId: number, actor: User, payload: IPilotFeedback.CreatePayload) {
    const target = await this.resolveTarget(tenantId, actor, payload)
    const feedback = await this.feedbackRepository.create({
      tenant_id: tenantId,
      user_id: actor.id,
      organization_id: target.organizationId,
      establishment_id: target.establishmentId,
      context: payload.context,
      rating: payload.rating,
      message: payload.message.trim(),
      status: 'new',
      reviewed_by: null,
      reviewed_at: null,
      internal_notes: null,
    })

    await this.auditService.logPermissionCheck(
      {
        userId: actor.id,
        resource: 'pilot_feedback',
        action: 'create',
        resourceId: feedback.id,
        result: 'granted',
        reason: 'Pilot feedback submitted',
        metadata: {
          tenant_id: tenantId,
          context: feedback.context,
          rating: feedback.rating,
          organization_id: feedback.organization_id,
          establishment_id: feedback.establishment_id,
        },
      },
      HttpContext.get() ?? undefined
    )

    return feedback
  }

  async list(tenantId: number, query: IPilotFeedback.ListQuery, actor: User) {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    return this.feedbackRepository.paginateForTenant(tenantId, query)
  }

  async review(tenantId: number, id: number, actor: User, payload: IPilotFeedback.ReviewPayload) {
    await this.organizationPolicy.requirePlatformAdmin(actor)

    const feedback = await db.transaction(async (client) => {
      const item = await this.feedbackRepository.findLocked(tenantId, id, client)
      if (!item) {
        throw new NotFoundException('Pilot feedback not found')
      }

      item.useTransaction(client)
      item.status = payload.status
      item.reviewed_by = actor.id
      item.reviewed_at = DateTime.now()
      item.internal_notes = this.normalizeOptionalText(payload.internal_notes)
      await item.save()
      return item
    })

    await this.auditService.logPermissionCheck(
      {
        userId: actor.id,
        resource: 'pilot_feedback',
        action: 'update',
        resourceId: feedback.id,
        result: 'granted',
        reason: 'Pilot feedback reviewed',
        metadata: {
          tenant_id: tenantId,
          status: feedback.status,
        },
      },
      HttpContext.get() ?? undefined
    )

    return feedback
  }

  private async resolveTarget(
    tenantId: number,
    actor: User,
    payload: IPilotFeedback.CreatePayload
  ): Promise<ResolvedTarget> {
    let organizationId = payload.organization_id ?? null
    const establishmentId = payload.establishment_id ?? null

    if (establishmentId !== null) {
      const establishment = await Establishment.query()
        .where('tenant_id', tenantId)
        .where('id', establishmentId)
        .first()

      if (!establishment) {
        throw new NotFoundException('Feedback target not found')
      }

      if (organizationId !== null && organizationId !== establishment.organization_id) {
        throw new NotFoundException('Feedback target not found')
      }

      organizationId = establishment.organization_id
    }

    if (organizationId !== null) {
      const organization = await Organization.query()
        .where('tenant_id', tenantId)
        .where('id', organizationId)
        .first()

      if (!organization) {
        throw new NotFoundException('Feedback target not found')
      }

      if (!(await this.organizationPolicy.isPlatformAdmin(actor))) {
        const membership = await OrganizationMember.query()
          .where('tenant_id', tenantId)
          .where('organization_id', organizationId)
          .where('user_id', actor.id)
          .where('status', 'active')
          .first()

        if (!membership) {
          throw new NotFoundException('Feedback target not found')
        }
      }
    } else if (payload.context === 'organization' || payload.context === 'establishment') {
      throw new BadRequestException('This feedback context requires an organization target')
    }

    if (payload.context === 'establishment' && establishmentId === null) {
      throw new BadRequestException('Establishment feedback requires an establishment target')
    }

    return { organizationId, establishmentId }
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? ''
    return normalized.length > 0 ? normalized : null
  }
}
