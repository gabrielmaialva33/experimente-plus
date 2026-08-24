import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import EstablishmentRepository from '#modules/establishments/repositories/establishment_repository'
import EstablishmentAuditService from '#modules/establishments/services/establishment_audit_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'

@inject()
export default class EstablishmentLifecycleModerationService {
  constructor(
    private organizationPolicy: OrganizationPolicyService,
    private establishmentRepository: EstablishmentRepository,
    private auditService: EstablishmentAuditService
  ) {}

  async suspend(tenantId: number, establishmentId: number, actor: User, reason: string) {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    const normalizedReason = this.requireReason(reason)

    const result = await db.transaction(async (client) => {
      const establishment = await this.establishmentRepository.findLocked(
        tenantId,
        establishmentId,
        client
      )
      if (!establishment) {
        throw new NotFoundException('Establishment not found')
      }
      if (establishment.lifecycle_status === 'archived') {
        throw new BadRequestException('Archived establishments cannot be suspended')
      }
      if (establishment.lifecycle_status !== 'suspended') {
        establishment.lifecycle_status = 'suspended'
        establishment.suspended_at = DateTime.now()
        await establishment.save()
      }
      return this.project(establishment)
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'suspend',
      resourceId: establishmentId,
      metadata: {
        tenant_id: tenantId,
        establishment_id: establishmentId,
        reason: normalizedReason,
      },
    })

    return result
  }

  async restore(tenantId: number, establishmentId: number, actor: User, reason?: string | null) {
    await this.organizationPolicy.requirePlatformAdmin(actor)
    const normalizedReason = reason?.trim() || null

    const result = await db.transaction(async (client) => {
      const establishment = await this.establishmentRepository.findLocked(
        tenantId,
        establishmentId,
        client
      )
      if (!establishment) {
        throw new NotFoundException('Establishment not found')
      }
      if (establishment.lifecycle_status === 'archived') {
        throw new BadRequestException('Archived establishments cannot be restored')
      }
      if (establishment.lifecycle_status === 'suspended') {
        establishment.lifecycle_status = 'active'
        establishment.suspended_at = null
        await establishment.save()
      }
      return this.project(establishment)
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'restore',
      resourceId: establishmentId,
      metadata: {
        tenant_id: tenantId,
        establishment_id: establishmentId,
        reason: normalizedReason,
      },
    })

    return result
  }

  private project(establishment: {
    id: number
    tenant_id: number
    organization_id: number
    lifecycle_status: string
    business_status: string
    published_revision_id: number | null
    suspended_at: DateTime | null
    archived_at: DateTime | null
  }) {
    return {
      id: establishment.id,
      tenant_id: establishment.tenant_id,
      organization_id: establishment.organization_id,
      lifecycle_status: establishment.lifecycle_status,
      business_status: establishment.business_status,
      published_revision_id: establishment.published_revision_id,
      suspended_at: establishment.suspended_at?.toISO() ?? null,
      archived_at: establishment.archived_at?.toISO() ?? null,
    }
  }

  private requireReason(value: string): string {
    const normalized = value.trim()
    if (normalized.length < 3) {
      throw new BadRequestException(
        'A suspension reason with at least three characters is required'
      )
    }
    return normalized
  }
}
