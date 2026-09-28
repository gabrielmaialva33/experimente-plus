import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import StoredFile from '#modules/files/models/file'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import MediaAsset from '#modules/media/models/media_asset'
import MediaModerationEvent from '#modules/media/models/media_moderation_event'

/**
 * Media rows for tests. They describe an image without storing bytes: the URL
 * points under `/uploads/factory/`, which is enough for projections and
 * serializers. Use the demo illustrations (`demoIllustration`) and the drive
 * when a test needs a real object behind the row.
 */
export const StoredFileFactory = factory
  .define(StoredFile, ({ faker }) => {
    const name = `${faker.string.alphanumeric(12).toLowerCase()}.png`
    return {
      tenant_id: 1,
      owner_id: 1,
      client_name: 'fachada.png',
      file_name: `factory/${name}`,
      file_size: faker.number.int({ min: 20_000, max: 90_000 }),
      file_type: 'image/png',
      file_category: 'image',
      url: `/uploads/factory/${name}`,
    }
  })
  .build()

export const MediaAssetFactory = factory
  .define(MediaAsset, ({ faker }) => ({
    tenant_id: 1,
    establishment_id: 1,
    file_id: 1,
    media_type: 'image' as const,
    file_extension: 'png' as const,
    mime_type: 'image/png' as const,
    checksum_sha256: faker.string.hexadecimal({ length: 64, prefix: '' }).toLowerCase(),
    width: 1200,
    height: 800,
    created_by: null,
  }))
  .build()

/**
 * An image in a revision's composition, pending by default. `approved`
 * records a reviewer, as the table requires; `cover` makes it the cover.
 */
export const EstablishmentRevisionMediaFactory = factory
  .define(EstablishmentRevisionMedia, () => ({
    tenant_id: 1,
    establishment_id: 1,
    revision_id: 1,
    media_asset_id: 1,
    purpose: 'gallery' as const,
    is_cover: false,
    sort_order: 0,
    alt_text: 'Ilustração original de um estabelecimento fictício',
    caption: null,
    moderation_status: 'pending' as const,
    created_by: null,
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
  }))
  .state('cover', (media) => {
    media.is_cover = true
  })
  .state('approved', (media) => {
    media.moderation_status = 'approved'
    media.reviewed_by ??= media.created_by
    media.reviewed_at = DateTime.utc()
  })
  .state('quarantined', (media) => {
    media.moderation_status = 'quarantined'
    media.is_cover = false
    media.reviewed_by ??= media.created_by
    media.reviewed_at = DateTime.utc()
    media.review_notes = 'Imagem retida pelo cenário de teste.'
  })
  .build()

/**
 * An entry of the append-only moderation history of one image in a revision
 * (never updated or deleted): the upload by default, then one state per
 * decision `MediaModerationService` records. Merge the identifiers from the
 * `EstablishmentRevisionMedia` row it describes and the acting user; a
 * rejection or quarantine carries its reason, as the table requires.
 */
export const MediaModerationEventFactory = factory
  .define(MediaModerationEvent, () => ({
    tenant_id: 1,
    establishment_id: 1,
    revision_id: 1,
    media_asset_id: 1,
    revision_media_id: 1,
    from_status: null,
    to_status: 'pending' as const,
    actor_id: 1,
    reason: null,
    metadata: { action: 'uploaded' },
  }))
  .state('approved', (event) => {
    event.from_status = 'pending'
    event.to_status = 'approved'
    event.metadata = { action: 'moderation_decision' }
  })
  .state('rejected', (event) => {
    event.from_status = 'pending'
    event.to_status = 'rejected'
    event.reason = 'A imagem não mostra o estabelecimento.'
    event.metadata = { action: 'moderation_decision' }
  })
  .state('quarantined', (event) => {
    event.from_status = 'pending'
    event.to_status = 'quarantined'
    event.reason = 'Imagem retida pelo cenário de teste.'
    event.metadata = { action: 'moderation_decision' }
  })
  .state('removed', (event) => {
    event.from_status = 'approved'
    event.to_status = 'removed'
    event.metadata = { action: 'removed_from_revision' }
  })
  .build()
