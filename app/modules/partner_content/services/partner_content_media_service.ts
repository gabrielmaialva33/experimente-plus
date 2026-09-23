import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'

import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { MultipartFile } from '@adonisjs/core/types/bodyparser'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import CatalogProjectionRepository from '#modules/catalog/repositories/catalog_projection_repository'
import FileRepository from '#modules/files/repositories/file_repository'
import MediaAssetRepository from '#modules/media/repositories/media_asset_repository'
import MediaAuditService from '#modules/media/services/media_audit_service'
import ImageProbeService from '#modules/media/services/image_probe_service'
import ImageMetadataStripper from '#modules/media/services/image_metadata_stripper'
import MediaStorageService from '#modules/media/services/media_storage_service'
import type IMedia from '#modules/media/interfaces/media_interface'
import IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import type PartnerContentMedia from '#modules/partner_content/models/partner_content_media'
import PartnerContentMediaRepository from '#modules/partner_content/repositories/partner_content_media_repository'
import PartnerContentPolicyRepository from '#modules/partner_content/repositories/partner_content_policy_repository'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import type User from '#modules/users/models/user'

interface MutationContext {
  kind: IPartnerContent.ContentKind
  tenantId: number
  contentId: number
  actor: User
}

@inject()
export default class PartnerContentMediaService {
  constructor(
    private contentService: PartnerContentService,
    private policyRepository: PartnerContentPolicyRepository,
    private fileRepository: FileRepository,
    private assetRepository: MediaAssetRepository,
    private mediaRepository: PartnerContentMediaRepository,
    private imageProbeService: ImageProbeService,
    private storageService: MediaStorageService,
    private auditService: MediaAuditService,
    private projectionRepository: CatalogProjectionRepository,
    private stripper: ImageMetadataStripper
  ) {}

  async upload(
    context: MutationContext,
    file: MultipartFile,
    payload: IPartnerContent.MediaCreatePayload
  ): Promise<IPartnerContent.MediaAdministrativeProjection> {
    // Metadata leaves before the probe, so the checksum and size it records are
    // of the file actually stored. A partner photographing from a phone
    // publishes its EXIF otherwise — position, device, sometimes a name — and
    // only review photos used to be protected.
    if (!file.tmpPath) throw new BadRequestException('The uploaded image could not be inspected')
    await this.stripper.stripFile(file.tmpPath)
    const probe = await this.imageProbeService.probe(file)
    let storedKey: string | null = null
    let mustCompensateStorage = true

    try {
      const result = await db.transaction(async (client) => {
        const content = await this.contentService.requireForPartnerMedia(
          context.kind,
          context.tenantId,
          context.contentId,
          context.actor,
          client
        )
        const policy = await this.policyRepository.getForTenant(context.tenantId, client)
        const count = await this.mediaRepository.countForContent(
          context.kind,
          context.tenantId,
          context.contentId,
          client
        )

        if (count >= policy.max_media_per_content) {
          throw new BadRequestException(
            'This operation allows at most ' +
              policy.max_media_per_content +
              ' images per partner content item'
          )
        }

        const key =
          'media/' +
          context.tenantId +
          '/' +
          content.establishment_id +
          '/partner-content/' +
          context.kind +
          '/' +
          context.contentId +
          '/' +
          randomUUID() +
          '.' +
          probe.extension
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
            establishment_id: content.establishment_id,
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
          await this.mediaRepository.clearCover(
            context.kind,
            context.tenantId,
            context.contentId,
            client
          )
        }

        const media = await this.mediaRepository.create(
          {
            tenant_id: context.tenantId,
            establishment_id: content.establishment_id,
            ...this.mediaRepository.targetAttributes(context.kind, context.contentId),
            media_asset_id: asset.id,
            is_cover: isCover,
            sort_order: await this.mediaRepository.nextSortOrder(
              context.kind,
              context.tenantId,
              context.contentId,
              client
            ),
            alt_text: payload.alt_text.trim(),
            caption: this.normalizeText(payload.caption),
            moderation_status: 'pending',
            created_by: context.actor.id,
            reviewed_by: null,
            reviewed_at: null,
            review_notes: null,
          },
          { client }
        )

        return {
          establishmentId: content.establishment_id,
          mediaId: media.id,
        }
      })

      mustCompensateStorage = false
      const media = await this.requireMedia(
        context.kind,
        context.tenantId,
        result.establishmentId,
        context.contentId,
        result.mediaId
      )

      await this.auditService.log({
        actorId: context.actor.id,
        action: 'create',
        resourceId: media.id,
        metadata: {
          tenant_id: context.tenantId,
          establishment_id: result.establishmentId,
          partner_content_kind: context.kind,
          partner_content_id: context.contentId,
          media_asset_id: media.media_asset_id,
        },
      })

      return this.administrative(context.kind, media)
    } catch (error) {
      if (mustCompensateStorage && storedKey) {
        try {
          await this.storageService.delete(storedKey)
        } catch (compensationError) {
          logger.error(
            { err: compensationError, storage_key: storedKey },
            'Failed to compensate an orphaned partner-content media upload'
          )
        }
      }
      throw error
    }
  }

  async update(
    context: MutationContext,
    mediaId: number,
    payload: IPartnerContent.MediaUpdatePayload
  ): Promise<IPartnerContent.MediaAdministrativeProjection> {
    if (payload.alt_text === undefined && payload.caption === undefined) {
      throw new BadRequestException('At least one media field must be provided')
    }

    const establishmentId = await db.transaction(async (client) => {
      const content = await this.contentService.requireForPartnerMedia(
        context.kind,
        context.tenantId,
        context.contentId,
        context.actor,
        client
      )
      const media = await this.mediaRepository.findLockedForContent(
        context.kind,
        context.tenantId,
        content.establishment_id,
        context.contentId,
        mediaId,
        client
      )
      if (!media) throw new NotFoundException('Partner content media not found')

      let changed = false
      if (payload.alt_text !== undefined) {
        const altText = payload.alt_text.trim()
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

      if (changed) {
        if (media.moderation_status !== 'pending') {
          media.moderation_status = 'pending'
          media.reviewed_by = null
          media.reviewed_at = null
          media.review_notes = null
        }
        await media.save()
      }

      return content.establishment_id
    })

    const media = await this.requireMedia(
      context.kind,
      context.tenantId,
      establishmentId,
      context.contentId,
      mediaId
    )

    await this.auditService.log({
      actorId: context.actor.id,
      action: 'update',
      resourceId: media.id,
      metadata: {
        tenant_id: context.tenantId,
        establishment_id: establishmentId,
        partner_content_kind: context.kind,
        partner_content_id: context.contentId,
        moderation_status: media.moderation_status,
      },
    })

    return this.administrative(context.kind, media)
  }

  async setCover(
    context: MutationContext,
    mediaId: number
  ): Promise<IPartnerContent.MediaAdministrativeProjection> {
    const establishmentId = await db.transaction(async (client) => {
      const content = await this.contentService.requireForPartnerMedia(
        context.kind,
        context.tenantId,
        context.contentId,
        context.actor,
        client
      )
      const media = await this.mediaRepository.findLockedForContent(
        context.kind,
        context.tenantId,
        content.establishment_id,
        context.contentId,
        mediaId,
        client
      )
      if (!media) throw new NotFoundException('Partner content media not found')
      if (media.moderation_status === 'rejected' || media.moderation_status === 'quarantined') {
        throw new BadRequestException('Rejected or quarantined media cannot be selected as cover')
      }

      await this.mediaRepository.clearCover(
        context.kind,
        context.tenantId,
        context.contentId,
        client,
        media.id
      )
      if (!media.is_cover) {
        media.is_cover = true
        await media.save()
      }
      return content.establishment_id
    })

    const media = await this.requireMedia(
      context.kind,
      context.tenantId,
      establishmentId,
      context.contentId,
      mediaId
    )

    await this.auditService.log({
      actorId: context.actor.id,
      action: 'assign',
      resourceId: media.id,
      metadata: {
        tenant_id: context.tenantId,
        establishment_id: establishmentId,
        partner_content_kind: context.kind,
        partner_content_id: context.contentId,
        assignment: 'cover',
      },
    })

    return this.administrative(context.kind, media)
  }

  async remove(context: MutationContext, mediaId: number): Promise<void> {
    let storageKeyToDelete: string | null = null
    let storageUrlToDelete: string | undefined
    let establishmentId = 0

    await db.transaction(async (client) => {
      const content = await this.contentService.requireForPartnerMedia(
        context.kind,
        context.tenantId,
        context.contentId,
        context.actor,
        client
      )
      establishmentId = content.establishment_id
      const media = await this.mediaRepository.findLockedForContent(
        context.kind,
        context.tenantId,
        content.establishment_id,
        context.contentId,
        mediaId,
        client
      )
      if (!media) throw new NotFoundException('Partner content media not found')

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
        storageUrlToDelete = storedFile.url
      }
    })

    if (storageKeyToDelete) {
      try {
        await this.storageService.delete(storageKeyToDelete, storageUrlToDelete)
      } catch (error) {
        logger.error(
          { err: error, storage_key: storageKeyToDelete },
          'Failed to remove an unreferenced partner-content media object from storage'
        )
      }
    }

    await this.auditService.log({
      actorId: context.actor.id,
      action: 'delete',
      resourceId: mediaId,
      metadata: {
        tenant_id: context.tenantId,
        establishment_id: establishmentId,
        partner_content_kind: context.kind,
        partner_content_id: context.contentId,
        storage_deleted: storageKeyToDelete !== null,
      },
    })
  }

  async approve(
    context: MutationContext,
    mediaId: number,
    reason?: string | null
  ): Promise<IPartnerContent.MediaAdministrativeProjection> {
    return this.moderate(context, mediaId, 'approved', reason)
  }

  async reject(
    context: MutationContext,
    mediaId: number,
    reason: string
  ): Promise<IPartnerContent.MediaAdministrativeProjection> {
    return this.moderate(context, mediaId, 'rejected', reason)
  }

  async quarantine(
    context: MutationContext,
    mediaId: number,
    reason: string
  ): Promise<IPartnerContent.MediaAdministrativeProjection> {
    return this.moderate(context, mediaId, 'quarantined', reason)
  }

  async listForPartner(
    context: MutationContext
  ): Promise<IPartnerContent.MediaAdministrativeProjection[]> {
    return db.transaction(async (client) => {
      const content = await this.contentService.requireForPartnerMedia(
        context.kind,
        context.tenantId,
        context.contentId,
        context.actor,
        client,
        false,
        true
      )
      const rows = await this.mediaRepository.listForContent(
        context.kind,
        context.tenantId,
        content.establishment_id,
        context.contentId,
        client
      )
      return rows.map((row) => this.administrative(context.kind, row))
    })
  }

  async projectAdministrativeContents(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    contents: readonly IPartnerContent.ContentRow[]
  ): Promise<Array<Record<string, unknown>>> {
    const media = await this.administrativeForContents(
      kind,
      tenantId,
      contents.map((content) => content.id)
    )

    return contents.map((content) => ({
      ...(content.serialize() as Record<string, unknown>),
      media: media.get(content.id) ?? [],
    }))
  }

  /**
   * The public payload, built field by field from the approved snapshot.
   *
   * This used to spread `content.serialize()`, and none of the three models
   * declares `serializeAs: null` on anything, so the response — cached as
   * `public, max-age=300` and embedded in the SSR HTML — carried the live
   * columns of an edit still awaiting moderation plus `status`, `tenant_id`,
   * `created_by`, `archived_by` and `archived_at`. Only the browser code kept
   * them off the screen, which meant the publication rule of ADR-0028 §4 was
   * implemented once in the web client and once in the app instead of once on
   * the server.
   *
   * Now it is implemented here and nowhere else. An item whose snapshot has no
   * usable title is dropped rather than rendered as a blank card, and the order
   * the repository chose is preserved.
   */
  async projectPublicContents(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    contents: readonly IPartnerContent.ContentRow[]
  ): Promise<IPartnerContent.PublicProjection[]> {
    const media = await this.publicForContents(
      kind,
      tenantId,
      contents.map((content) => content.id)
    )

    return contents.flatMap((content) => {
      const projection = this.publicContent(kind, content, media.get(content.id) ?? [])
      return projection ? [projection] : []
    })
  }

  async administrativeForContents(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    contentIds: readonly number[]
  ): Promise<Map<number, IPartnerContent.MediaAdministrativeProjection[]>> {
    const rows = await this.mediaRepository.listForContents(kind, tenantId, contentIds)
    const result = new Map<number, IPartnerContent.MediaAdministrativeProjection[]>()

    for (const row of rows) {
      const contentId = this.contentId(kind, row)
      const current = result.get(contentId) ?? []
      current.push(this.administrative(kind, row))
      result.set(contentId, current)
    }

    return result
  }

  async publicForContents(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    contentIds: readonly number[]
  ): Promise<Map<number, IPartnerContent.MediaPublicProjection[]>> {
    const rows = await this.mediaRepository.listForContents(kind, tenantId, contentIds, true)
    const result = new Map<number, IPartnerContent.MediaPublicProjection[]>()

    for (const row of rows) {
      const contentId = this.contentId(kind, row)
      const current = result.get(contentId) ?? []
      current.push(this.publicProjection(row))
      result.set(contentId, current)
    }

    return result
  }

  private async moderate(
    context: MutationContext,
    mediaId: number,
    targetStatus: IMedia.ModerationStatus,
    reason?: string | null
  ): Promise<IPartnerContent.MediaAdministrativeProjection> {
    const normalizedReason = this.normalizeText(reason)
    if ((targetStatus === 'rejected' || targetStatus === 'quarantined') && !normalizedReason) {
      throw new BadRequestException('A moderation reason is required')
    }

    const establishmentId = await db.transaction(async (client) => {
      const content = await this.contentService.requireForModeratorMedia(
        context.kind,
        context.tenantId,
        context.contentId,
        context.actor,
        client
      )
      const media = await this.mediaRepository.findLockedForModeration(
        context.kind,
        context.tenantId,
        context.contentId,
        mediaId,
        client
      )
      if (!media || media.establishment_id !== content.establishment_id) {
        throw new NotFoundException('Partner content media not found')
      }

      if (targetStatus === 'approved' && !media.alt_text.trim()) {
        throw new BadRequestException('Approved media requires descriptive alternative text')
      }

      if (targetStatus === 'rejected' || targetStatus === 'quarantined') {
        media.is_cover = false
      }
      media.moderation_status = targetStatus
      media.reviewed_by = context.actor.id
      media.reviewed_at = DateTime.utc()
      media.review_notes = normalizedReason
      await media.save()

      // Approving, rejecting and quarantining all change what the public may
      // see, and the public cache keys carry `projection_version` (ADR-0016 §5).
      // Without this bump an approved image would stay invisible, and a
      // quarantined one would stay on screen, until the TTL happened to expire.
      await this.projectionRepository.bumpTenantVersion(context.tenantId, client)

      return content.establishment_id
    })

    const media = await this.requireMedia(
      context.kind,
      context.tenantId,
      establishmentId,
      context.contentId,
      mediaId
    )

    await this.auditService.log({
      actorId: context.actor.id,
      action: targetStatus,
      resourceId: media.id,
      metadata: {
        tenant_id: context.tenantId,
        establishment_id: establishmentId,
        partner_content_kind: context.kind,
        partner_content_id: context.contentId,
        moderation_status: targetStatus,
      },
    })

    return this.administrative(context.kind, media)
  }

  private async requireMedia(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    establishmentId: number,
    contentId: number,
    mediaId: number
  ): Promise<PartnerContentMedia> {
    const rows = await this.mediaRepository.listForContent(
      kind,
      tenantId,
      establishmentId,
      contentId
    )
    const media = rows.find((row) => row.id === mediaId)
    if (!media) throw new NotFoundException('Partner content media not found')
    return media
  }

  private contentId(kind: IPartnerContent.ContentKind, media: PartnerContentMedia): number {
    if (kind === 'experience') return media.experience_id!
    if (kind === 'event') return media.event_id!
    return media.showcase_item_id!
  }

  private administrative(
    kind: IPartnerContent.ContentKind,
    media: PartnerContentMedia
  ): IPartnerContent.MediaAdministrativeProjection {
    return {
      id: media.id,
      establishment_id: media.establishment_id,
      content_id: this.contentId(kind, media),
      is_cover: media.is_cover,
      sort_order: media.sort_order,
      alt_text: media.alt_text,
      caption: media.caption,
      moderation_status: media.moderation_status,
      review_notes: media.review_notes,
      reviewed_at: media.reviewed_at?.toISO() ?? null,
      created_at: media.created_at.toISO() ?? '',
      updated_at: media.updated_at.toISO() ?? '',
      asset: this.asset(media),
    }
  }

  /**
   * One public item, or nothing.
   *
   * Every value comes from `published_snapshot`; the live row contributes only
   * the identity and `published_at`, which the database ties to the snapshot
   * (`(published_snapshot IS NULL) = (published_at IS NULL)`). A row that
   * somehow breaks that tie is treated as unpublishable rather than served with
   * an invented date.
   */
  private publicContent(
    kind: IPartnerContent.ContentKind,
    content: IPartnerContent.ContentRow,
    media: IPartnerContent.MediaPublicProjection[]
  ): IPartnerContent.PublicProjection | null {
    const snapshot = content.published_snapshot

    if (!snapshot) return null

    const title = this.snapshotText(snapshot.title)
    const publishedAt = content.published_at?.toUTC().toISO() ?? null

    if (!title || !publishedAt) return null

    const startsAt = kind === 'event' ? this.snapshotInstant(snapshot.starts_at) : null
    const endsAt = kind === 'event' ? this.snapshotInstant(snapshot.ends_at) : null

    // An event without its approved window cannot be placed in time, and a
    // public surface that guesses would be worse than one that omits.
    if (kind === 'event' && (!startsAt || !endsAt)) return null

    return {
      id: content.id,
      kind,
      title,
      description: this.snapshotText(snapshot.description),
      starts_at: startsAt,
      ends_at: endsAt,
      informational_price_cents:
        kind === 'showcase_item' ? this.snapshotCents(snapshot.informational_price_cents) : null,
      published_at: publishedAt,
      media,
    }
  }

  private snapshotText(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  /**
   * Snapshot timestamps are re-emitted in UTC so the same item serializes
   * identically whatever zone the connection returned it in — SSR markup and the
   * hydrated page have to agree byte for byte.
   */
  private snapshotInstant(value: unknown): string | null {
    const raw = this.snapshotText(value)
    if (!raw) return null
    const parsed = DateTime.fromISO(raw, { zone: 'utc' })
    return parsed.isValid ? parsed.toISO() : null
  }

  private snapshotCents(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return Math.max(0, Math.trunc(value))
  }

  private publicProjection(media: PartnerContentMedia): IPartnerContent.MediaPublicProjection {
    const asset = this.asset(media)
    return {
      id: media.id,
      is_cover: media.is_cover,
      sort_order: media.sort_order,
      alt_text: media.alt_text,
      caption: media.caption,
      asset: {
        id: asset.id,
        media_type: asset.media_type,
        file_extension: asset.file_extension,
        mime_type: asset.mime_type,
        width: asset.width,
        height: asset.height,
        url: asset.url,
      },
    }
  }

  private asset(media: PartnerContentMedia): IMedia.AssetProjection {
    return {
      id: media.asset.id,
      media_type: media.asset.media_type,
      file_extension: media.asset.file_extension,
      mime_type: media.asset.mime_type,
      width: media.asset.width,
      height: media.asset.height,
      checksum_sha256: media.asset.checksum_sha256,
      url: media.asset.file.url,
    }
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
