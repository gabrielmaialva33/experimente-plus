import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'

import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { MultipartFile } from '@adonisjs/core/types/bodyparser'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import FileRepository from '#modules/files/repositories/file_repository'
import {
  MEDIA_MAX_ITEMS_PER_REVISION,
  type IMedia,
} from '#modules/media/interfaces/media_interface'
import MediaAssetRepository from '#modules/media/repositories/media_asset_repository'
import EstablishmentRevisionMediaRepository from '#modules/media/repositories/establishment_revision_media_repository'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import type User from '#modules/users/models/user'
import ImageProbeService from '#modules/media/services/image_probe_service'
import MediaAuditService from '#modules/media/services/media_audit_service'
import MediaEventService from '#modules/media/services/media_event_service'
import MediaProjectionService from '#modules/media/services/media_projection_service'
import MediaStorageService from '#modules/media/services/media_storage_service'

interface MutationContext {
  tenantId: number
  establishmentId: number
  actor: User
}

@inject()
export default class EstablishmentMediaService {
  constructor(
    private accessService: EstablishmentAccessService,
    private revisionRepository: EstablishmentRevisionRepository,
    private fileRepository: FileRepository,
    private assetRepository: MediaAssetRepository,
    private mediaRepository: EstablishmentRevisionMediaRepository,
    private imageProbeService: ImageProbeService,
    private storageService: MediaStorageService,
    private eventService: MediaEventService,
    private projectionService: MediaProjectionService,
    private auditService: MediaAuditService
  ) {}

  async list(
    tenantId: number,
    establishmentId: number,
    actor: User
  ): Promise<IMedia.AdministrativeProjection[]> {
    const establishment = await this.accessService.getReadable(tenantId, establishmentId, actor)
    const openRevision = await this.revisionRepository.findOpenForEstablishment(
      tenantId,
      establishmentId
    )
    const revisionId = openRevision?.id ?? establishment.published_revision_id

    if (!revisionId) {
      return []
    }

    const media = await this.mediaRepository.listForRevision(tenantId, establishmentId, revisionId)

    return media.map((item) => this.projectionService.administrative(item))
  }

  async upload(
    context: MutationContext,
    file: MultipartFile,
    payload: IMedia.CreatePayload
  ): Promise<IMedia.AdministrativeProjection> {
    const probe = await this.imageProbeService.probe(file)
    let storedKey: string | null = null
    let mustCompensateStorage = true

    try {
      const result = await db.transaction(async (client) => {
        const { revision } = await this.accessService.getEditable(
          context.tenantId,
          context.establishmentId,
          context.actor,
          client
        )
        const count = await this.mediaRepository.countForRevision(
          context.tenantId,
          revision.id,
          client
        )

        if (count >= MEDIA_MAX_ITEMS_PER_REVISION) {
          throw new BadRequestException(
            `An establishment revision may contain at most ${MEDIA_MAX_ITEMS_PER_REVISION} images`
          )
        }

        const key = `media/${context.tenantId}/${context.establishmentId}/${revision.id}/${randomUUID()}.${probe.extension}`
        const stored = await this.storageService.store(file, key)
        storedKey = stored.key

        const storedFile = await this.fileRepository.create(
          {
            owner_id: context.actor.id,
            tenant_id: context.tenantId,
            client_name: this.safeClientName(file.clientName),
            file_name: stored.key,
            file_size: probe.size,
            file_type: probe.mime_type,
            file_category: 'image',
            url: stored.url,
          },
          { client }
        )

        const asset = await this.assetRepository.create(
          {
            tenant_id: context.tenantId,
            establishment_id: context.establishmentId,
            file_id: storedFile.id,
            media_type: 'image',
            file_extension: probe.extension,
            mime_type: probe.mime_type,
            checksum_sha256: probe.checksum_sha256,
            width: probe.width,
            height: probe.height,
            created_by: context.actor.id,
          },
          { client }
        )

        const isCover = payload.is_cover ?? count === 0
        if (isCover) {
          await this.mediaRepository.clearCover(context.tenantId, revision.id, client)
        }

        const media = await this.mediaRepository.create(
          {
            tenant_id: context.tenantId,
            establishment_id: context.establishmentId,
            revision_id: revision.id,
            media_asset_id: asset.id,
            purpose: payload.purpose ?? 'gallery',
            is_cover: isCover,
            sort_order: await this.mediaRepository.nextSortOrder(
              context.tenantId,
              revision.id,
              client
            ),
            alt_text: this.normalizeText(payload.alt_text),
            caption: this.normalizeText(payload.caption),
            moderation_status: 'pending',
            created_by: context.actor.id,
            reviewed_by: null,
            reviewed_at: null,
            review_notes: null,
          },
          { client }
        )

        await this.eventService.record(
          media,
          context.actor.id,
          null,
          'pending',
          null,
          { action: 'uploaded' },
          client
        )

        return { mediaId: media.id, revisionId: revision.id }
      })

      mustCompensateStorage = false
      const media = await this.requireMedia(
        context.tenantId,
        context.establishmentId,
        result.revisionId,
        result.mediaId
      )

      await this.auditService.log({
        actorId: context.actor.id,
        action: 'create',
        resourceId: media.id,
        metadata: {
          tenant_id: context.tenantId,
          establishment_id: context.establishmentId,
          revision_id: result.revisionId,
          media_asset_id: media.media_asset_id,
        },
      })

      return this.projectionService.administrative(media)
    } catch (error) {
      if (mustCompensateStorage && storedKey) {
        try {
          await this.storageService.delete(storedKey)
        } catch (compensationError) {
          logger.error(
            { err: compensationError, storage_key: storedKey },
            'Failed to compensate an orphaned establishment media upload'
          )
        }
      }

      throw error
    }
  }

  async update(
    context: MutationContext,
    mediaId: number,
    payload: IMedia.UpdatePayload
  ): Promise<IMedia.AdministrativeProjection> {
    if (
      payload.purpose === undefined &&
      payload.alt_text === undefined &&
      payload.caption === undefined
    ) {
      throw new BadRequestException('At least one media field must be provided')
    }

    const result = await db.transaction(async (client) => {
      const { revision } = await this.accessService.getEditable(
        context.tenantId,
        context.establishmentId,
        context.actor,
        client
      )
      const media = await this.mediaRepository.findLockedForRevision(
        context.tenantId,
        context.establishmentId,
        revision.id,
        mediaId,
        client
      )

      if (!media) {
        throw new NotFoundException('Establishment media not found')
      }

      const previousStatus = media.moderation_status
      let changed = false

      if (payload.purpose !== undefined && payload.purpose !== media.purpose) {
        media.purpose = payload.purpose
        changed = true
      }

      if (payload.alt_text !== undefined) {
        const altText = this.normalizeText(payload.alt_text)
        if (altText !== media.alt_text) {
          media.alt_text = altText
          changed = true
        }
      }

      if (payload.caption !== undefined) {
        const caption = this.normalizeText(payload.caption)
        if (caption !== media.caption) {
          media.caption = caption
          changed = true
        }
      }

      if (!changed) {
        return { mediaId: media.id, revisionId: revision.id, changed: false }
      }

      if (previousStatus !== 'pending') {
        media.moderation_status = 'pending'
        media.reviewed_by = null
        media.reviewed_at = null
        media.review_notes = null
      }

      await media.save()
      await this.eventService.record(
        media,
        context.actor.id,
        previousStatus,
        media.moderation_status,
        null,
        { action: 'metadata_updated' },
        client
      )

      return { mediaId: media.id, revisionId: revision.id, changed: true }
    })

    const media = await this.requireMedia(
      context.tenantId,
      context.establishmentId,
      result.revisionId,
      result.mediaId
    )

    if (result.changed) {
      await this.auditService.log({
        actorId: context.actor.id,
        action: 'update',
        resourceId: media.id,
        metadata: {
          tenant_id: context.tenantId,
          establishment_id: context.establishmentId,
          revision_id: result.revisionId,
          moderation_status: media.moderation_status,
        },
      })
    }

    return this.projectionService.administrative(media)
  }

  async setCover(
    context: MutationContext,
    mediaId: number
  ): Promise<IMedia.AdministrativeProjection> {
    const result = await db.transaction(async (client) => {
      const { revision } = await this.accessService.getEditable(
        context.tenantId,
        context.establishmentId,
        context.actor,
        client
      )
      const media = await this.mediaRepository.findLockedForRevision(
        context.tenantId,
        context.establishmentId,
        revision.id,
        mediaId,
        client
      )

      if (!media) {
        throw new NotFoundException('Establishment media not found')
      }

      if (media.moderation_status === 'rejected' || media.moderation_status === 'quarantined') {
        throw new BadRequestException('Rejected or quarantined media cannot be selected as cover')
      }

      await this.mediaRepository.clearCover(context.tenantId, revision.id, client, media.id)

      if (!media.is_cover) {
        media.is_cover = true
        await media.save()
        await this.eventService.record(
          media,
          context.actor.id,
          media.moderation_status,
          media.moderation_status,
          null,
          { action: 'cover_selected' },
          client
        )
      }

      return { mediaId: media.id, revisionId: revision.id }
    })

    const media = await this.requireMedia(
      context.tenantId,
      context.establishmentId,
      result.revisionId,
      result.mediaId
    )

    await this.auditService.log({
      actorId: context.actor.id,
      action: 'assign',
      resourceId: media.id,
      metadata: {
        tenant_id: context.tenantId,
        establishment_id: context.establishmentId,
        revision_id: result.revisionId,
        assignment: 'cover',
      },
    })

    return this.projectionService.administrative(media)
  }

  async reorder(
    context: MutationContext,
    payload: IMedia.ReorderItem[]
  ): Promise<IMedia.AdministrativeProjection[]> {
    const ids = payload.map((item) => item.id)
    const orders = payload.map((item) => item.sort_order).sort((left, right) => left - right)

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Media identifiers must be unique')
    }

    if (new Set(orders).size !== orders.length || orders.some((value, index) => value !== index)) {
      throw new BadRequestException(
        'Media sort order must be a contiguous sequence starting at zero'
      )
    }

    const revisionId = await db.transaction(async (client) => {
      const { revision } = await this.accessService.getEditable(
        context.tenantId,
        context.establishmentId,
        context.actor,
        client
      )
      const media = await this.mediaRepository.listForRevision(
        context.tenantId,
        context.establishmentId,
        revision.id,
        client
      )
      const currentIds = new Set(media.map((item) => item.id))

      if (media.length !== payload.length || ids.some((id) => !currentIds.has(id))) {
        throw new BadRequestException('The complete current media collection must be supplied')
      }

      const orderById = new Map(payload.map((item) => [item.id, item.sort_order]))

      for (const [index, item] of media.entries()) {
        item.sort_order = 1_000_000 + index
        await item.save()
      }

      for (const item of media) {
        item.sort_order = orderById.get(item.id)!
        await item.save()
      }

      return revision.id
    })

    const media = await this.mediaRepository.listForRevision(
      context.tenantId,
      context.establishmentId,
      revisionId
    )

    await this.auditService.log({
      actorId: context.actor.id,
      action: 'update',
      resourceId: context.establishmentId,
      metadata: {
        tenant_id: context.tenantId,
        establishment_id: context.establishmentId,
        revision_id: revisionId,
        operation: 'media_reordered',
        media_ids: ids,
      },
    })

    return media.map((item) => this.projectionService.administrative(item))
  }

  async remove(context: MutationContext, mediaId: number): Promise<void> {
    let storageKeyToDelete: string | null = null

    await db.transaction(async (client) => {
      const { revision } = await this.accessService.getEditable(
        context.tenantId,
        context.establishmentId,
        context.actor,
        client
      )
      const media = await this.mediaRepository.findLockedForRevision(
        context.tenantId,
        context.establishmentId,
        revision.id,
        mediaId,
        client
      )

      if (!media) {
        throw new NotFoundException('Establishment media not found')
      }

      await this.eventService.record(
        media,
        context.actor.id,
        media.moderation_status,
        'removed',
        null,
        { action: 'removed_from_revision' },
        client
      )

      const asset = media.asset
      const storedFile = asset.file

      await media.delete()

      const referenceCount = await this.assetRepository.countReferences(asset.id, client)
      if (referenceCount === 0) {
        asset.useTransaction(client)
        storedFile.useTransaction(client)
        await asset.delete()
        await storedFile.delete()
        storageKeyToDelete = storedFile.file_name
      }
    })

    if (storageKeyToDelete) {
      try {
        await this.storageService.delete(storageKeyToDelete)
      } catch (error) {
        logger.error(
          { err: error, storage_key: storageKeyToDelete },
          'Failed to remove an unreferenced establishment media object from storage'
        )
      }
    }

    await this.auditService.log({
      actorId: context.actor.id,
      action: 'delete',
      resourceId: mediaId,
      metadata: {
        tenant_id: context.tenantId,
        establishment_id: context.establishmentId,
        storage_deleted: storageKeyToDelete !== null,
      },
    })
  }

  private async requireMedia(
    tenantId: number,
    establishmentId: number,
    revisionId: number,
    mediaId: number
  ) {
    const media = await this.mediaRepository.listForRevision(tenantId, establishmentId, revisionId)
    const item = media.find((candidate) => candidate.id === mediaId)

    if (!item) {
      throw new NotFoundException('Establishment media not found')
    }

    return item
  }

  private safeClientName(clientName: string): string {
    const normalized = [...basename(clientName)]
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0
        return codePoint >= 32 && codePoint !== 127
      })
      .join('')
      .trim()
      .slice(0, 255)

    return normalized || 'image'
  }

  private normalizeText(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? ''
    return normalized.length > 0 ? normalized : null
  }
}
