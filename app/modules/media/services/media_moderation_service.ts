import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IMedia from '#modules/media/interfaces/media_interface'
import EstablishmentRevisionMediaRepository from '#modules/media/repositories/establishment_revision_media_repository'
import MediaAuditService from '#modules/media/services/media_audit_service'
import MediaEventService from '#modules/media/services/media_event_service'
import MediaProjectionService from '#modules/media/services/media_projection_service'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'

@inject()
export default class MediaModerationService {
  constructor(
    private organizationPolicy: OrganizationPolicyService,
    private mediaRepository: EstablishmentRevisionMediaRepository,
    private eventService: MediaEventService,
    private projectionService: MediaProjectionService,
    private auditService: MediaAuditService
  ) {}

  async list(query: IMedia.ModerationQuery, actor: User) {
    await this.organizationPolicy.requirePlatformModerator(actor)

    const paginator = await this.mediaRepository.listForModeration(query)

    return {
      meta: paginator.getMeta(),
      data: paginator.all().map((item) => this.projectionService.administrative(item)),
    }
  }

  async approve(
    mediaId: number,
    actor: User,
    reason?: string | null
  ): Promise<IMedia.AdministrativeProjection> {
    return this.transition(mediaId, actor, 'approved', reason)
  }

  async reject(
    mediaId: number,
    actor: User,
    reason: string
  ): Promise<IMedia.AdministrativeProjection> {
    return this.transition(mediaId, actor, 'rejected', reason)
  }

  async quarantine(
    mediaId: number,
    actor: User,
    reason: string
  ): Promise<IMedia.AdministrativeProjection> {
    return this.transition(mediaId, actor, 'quarantined', reason)
  }

  private async transition(
    mediaId: number,
    actor: User,
    targetStatus: IMedia.ModerationStatus,
    reason?: string | null
  ): Promise<IMedia.AdministrativeProjection> {
    await this.organizationPolicy.requirePlatformModerator(actor)

    const normalizedReason = this.normalizeReason(reason)
    if ((targetStatus === 'rejected' || targetStatus === 'quarantined') && !normalizedReason) {
      throw new BadRequestException('A moderation reason is required')
    }

    const changed = await db.transaction(async (client) => {
      const media = await this.mediaRepository.findLockedForModeration(mediaId, client)

      if (!media) {
        throw new NotFoundException('Establishment media not found')
      }

      if (targetStatus === 'approved' && !media.alt_text?.trim()) {
        throw new BadRequestException('Approved media requires descriptive alternative text')
      }

      const previousStatus = media.moderation_status
      const previousReason = media.review_notes
      const nextReason = normalizedReason

      if (previousStatus === targetStatus && previousReason === nextReason) {
        return false
      }

      if (targetStatus === 'rejected' || targetStatus === 'quarantined') {
        media.is_cover = false
      }

      media.moderation_status = targetStatus
      media.reviewed_by = actor.id
      media.reviewed_at = DateTime.now()
      media.review_notes = nextReason
      await media.save()

      await this.eventService.record(
        media,
        actor.id,
        previousStatus,
        targetStatus,
        nextReason,
        { action: 'moderation_decision' },
        client
      )

      return true
    })

    const media = await this.mediaRepository.findByIdWithDetails(mediaId)
    if (!media) {
      throw new NotFoundException('Establishment media not found')
    }

    if (changed) {
      await this.auditService.log({
        actorId: actor.id,
        action: targetStatus,
        resourceId: media.id,
        metadata: {
          tenant_id: media.tenant_id,
          establishment_id: media.establishment_id,
          revision_id: media.revision_id,
          media_asset_id: media.media_asset_id,
          moderation_status: targetStatus,
        },
      })
    }

    return this.projectionService.administrative(media)
  }

  private normalizeReason(reason: string | null | undefined): string | null {
    const normalized = reason?.trim() ?? ''
    return normalized.length > 0 ? normalized : null
  }
}
