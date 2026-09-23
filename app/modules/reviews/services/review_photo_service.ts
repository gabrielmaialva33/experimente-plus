import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'

import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { MultipartFile } from '@adonisjs/core/types/bodyparser'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import FileRepository from '#modules/files/repositories/file_repository'
import MediaAssetRepository from '#modules/media/repositories/media_asset_repository'
import ImageMetadataStripper from '#modules/media/services/image_metadata_stripper'
import ImageProbeService from '#modules/media/services/image_probe_service'
import MediaAuditService from '#modules/media/services/media_audit_service'
import MediaStorageService from '#modules/media/services/media_storage_service'
import type IReview from '#modules/reviews/interfaces/review_interface'
import EstablishmentReviewPhoto from '#modules/reviews/models/establishment_review_photo'
import EstablishmentReviewRepository from '#modules/reviews/repositories/establishment_review_repository'
import ReviewPhotoRepository from '#modules/reviews/repositories/review_photo_repository'
import ReviewPolicyRepository from '#modules/reviews/repositories/review_policy_repository'
import type User from '#modules/users/models/user'

/**
 * Photos on an Explorer's review — ADR-0027, Anexo I item 8.
 *
 * They go through the media pipeline of ADR-0014: the same probe, the same
 * formats (JPEG, PNG, WebP — HEIC stays rejected), the same storage, `files` and
 * `media_assets`. Two things differ from establishment media, both on purpose:
 *
 * - The file is stripped of its metadata before anything else reads it. An
 *   Explorer's photo can carry the GPS position of their home; an establishment
 *   photographing its own façade publishes nothing new.
 * - There is no moderation state per photo. A photo is part of the review and is
 *   public exactly when the review is, and moderated the same way: by report,
 *   by ban, by the establishment leaving the catalogue.
 */
@inject()
export default class ReviewPhotoService {
  constructor(
    private reviews: EstablishmentReviewRepository,
    private photos: ReviewPhotoRepository,
    private policies: ReviewPolicyRepository,
    private files: FileRepository,
    private assets: MediaAssetRepository,
    private stripper: ImageMetadataStripper,
    private probe: ImageProbeService,
    private storage: MediaStorageService,
    private audit: MediaAuditService
  ) {}

  async upload(
    tenantId: number,
    reviewId: number,
    actor: User,
    file: MultipartFile,
    payload: IReview.ReviewPhotoPayload
  ): Promise<IReview.ReviewPhotoProjection> {
    if (!file.tmpPath) throw new BadRequestException('The uploaded image could not be inspected')

    // Before the probe, so the checksum and size it records are of the file
    // that is actually stored.
    await this.stripper.stripFile(file.tmpPath)
    const probe = await this.probe.probe(file)

    let storedKey: string | null = null
    let compensate = true

    try {
      const photoId = await db.transaction(async (client) => {
        const review = await this.reviews.findById(tenantId, reviewId, client, true)
        if (!review) throw new NotFoundException('Review not found')
        if (review.user_id !== actor.id) {
          throw new ForbiddenException('You can only add photos to your own reviews')
        }
        if (review.status === 'archived') throw new NotFoundException('Review not found')

        const policy = await this.policies.getForTenant(tenantId, client)
        // Attaching photos follows the edit window, not the interval between
        // edits: that interval exists to slow down rewording, and applying it
        // here would stop someone attaching photos right after writing.
        const days = DateTime.utc().diff(review.created_at, 'days').days
        if (days > policy.edit_window_days) {
          throw new BadRequestException('Edit window has expired')
        }

        const count = await this.photos.countForReview(tenantId, reviewId, client)
        if (policy.max_photos <= 0) {
          throw new BadRequestException('This operation does not accept photos on reviews')
        }
        if (count >= policy.max_photos) {
          throw new BadRequestException(
            `Maximum photos limit exceeded (allowed: ${policy.max_photos})`
          )
        }

        const key = `media/${tenantId}/${review.establishment_id}/reviews/${reviewId}/${randomUUID()}.${probe.extension}`
        const stored = await this.storage.store(file, key)
        storedKey = stored.key

        const storedFile = await this.files.create(
          {
            owner_id: actor.id,
            tenant_id: tenantId,
            client_name: this.safeClientName(file.clientName),
            file_name: stored.key,
            file_size: probe.size,
            file_type: probe.mime_type,
            file_category: 'image',
            url: stored.url,
          },
          { client }
        )

        const asset = await this.assets.create(
          {
            tenant_id: tenantId,
            establishment_id: review.establishment_id,
            file_id: storedFile.id,
            media_type: 'image',
            file_extension: probe.extension,
            mime_type: probe.mime_type,
            checksum_sha256: probe.checksum_sha256,
            width: probe.width,
            height: probe.height,
            created_by: actor.id,
          },
          { client }
        )

        const photo = await EstablishmentReviewPhoto.create(
          {
            tenant_id: tenantId,
            establishment_id: review.establishment_id,
            review_id: reviewId,
            media_asset_id: asset.id,
            sort_order: await this.photos.nextSortOrder(tenantId, reviewId, client),
            alt_text: payload.alt_text?.trim() || null,
          },
          { client }
        )

        // The counter is the server's, derived from what exists. It used to be
        // declared by the client, which could claim photos it never sent.
        review.useTransaction(client)
        review.photos_count = count + 1
        await review.save()

        return photo.id
      })

      compensate = false
      const photo = await this.photos.findWithAsset(tenantId, photoId)
      await this.audit.log({
        actorId: actor.id,
        action: 'create',
        resourceId: photo.media_asset_id,
        metadata: { tenant_id: tenantId, review_id: reviewId, review_photo_id: photo.id },
      })
      return photo.projection()
    } catch (error) {
      if (compensate && storedKey) {
        try {
          await this.storage.delete(storedKey)
        } catch (compensationError) {
          logger.error(
            { err: compensationError, storage_key: storedKey },
            'Failed to compensate an orphaned review photo upload'
          )
        }
      }
      throw error
    }
  }

  /**
   * Removes a photo and everything behind it. The file leaves storage after the
   * rows are gone, so a failed deletion leaves an orphaned object — logged —
   * rather than a public row pointing at nothing.
   */
  async remove(tenantId: number, reviewId: number, photoId: number, actor: User): Promise<void> {
    const removed = await db.transaction(async (client) => {
      const review = await this.reviews.findById(tenantId, reviewId, client, true)
      if (!review) throw new NotFoundException('Review not found')
      if (review.user_id !== actor.id) {
        throw new ForbiddenException('You can only remove photos from your own reviews')
      }

      const photo = await this.photos.findForReview(tenantId, reviewId, photoId, client)
      if (!photo) throw new NotFoundException('Photo not found')

      const asset = photo.asset
      const storedFile = asset.file
      photo.useTransaction(client)
      await photo.delete()
      asset.useTransaction(client)
      await asset.delete()
      storedFile.useTransaction(client)
      await storedFile.delete()

      review.useTransaction(client)
      review.photos_count = await this.photos.countForReview(tenantId, reviewId, client)
      await review.save()

      return { key: storedFile.file_name, url: storedFile.url, assetId: asset.id }
    })

    try {
      await this.storage.delete(removed.key, removed.url)
    } catch (error) {
      logger.error(
        { err: error, storage_key: removed.key },
        'Failed to delete the stored file of a removed review photo'
      )
    }

    await this.audit.log({
      actorId: actor.id,
      action: 'delete',
      resourceId: removed.assetId,
      metadata: { tenant_id: tenantId, review_id: reviewId, review_photo_id: photoId },
    })
  }

  private safeClientName(name: string): string {
    return basename(name).slice(0, 255) || 'foto'
  }
}
