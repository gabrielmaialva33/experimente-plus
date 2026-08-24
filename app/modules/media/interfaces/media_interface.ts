export const MEDIA_TYPES = ['image'] as const
export const MEDIA_PURPOSES = [
  'gallery',
  'logo',
  'menu',
  'interior',
  'exterior',
  'product',
  'team',
  'service',
] as const
export const MEDIA_MODERATION_STATUSES = ['pending', 'approved', 'rejected', 'quarantined'] as const
export const MEDIA_EVENT_STATUSES = [...MEDIA_MODERATION_STATUSES, 'removed'] as const
export const MEDIA_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const
export const MEDIA_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const MEDIA_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const MEDIA_MAX_DIMENSION = 12_000
export const MEDIA_MAX_PIXEL_AREA = 60_000_000
export const MEDIA_MAX_ITEMS_PER_REVISION = 20

export namespace IMedia {
  export type Type = (typeof MEDIA_TYPES)[number]
  export type Purpose = (typeof MEDIA_PURPOSES)[number]
  export type ModerationStatus = (typeof MEDIA_MODERATION_STATUSES)[number]
  export type EventStatus = (typeof MEDIA_EVENT_STATUSES)[number]
  export type ImageExtension = (typeof MEDIA_IMAGE_EXTENSIONS)[number]
  export type ImageMimeType = (typeof MEDIA_IMAGE_MIME_TYPES)[number]

  export interface ImageProbeResult {
    extension: ImageExtension
    mime_type: ImageMimeType
    width: number
    height: number
    checksum_sha256: string
    size: number
  }

  export interface CreatePayload {
    purpose?: Purpose
    is_cover?: boolean
    alt_text?: string | null
    caption?: string | null
  }

  export interface UpdatePayload {
    purpose?: Purpose
    alt_text?: string | null
    caption?: string | null
  }

  export interface ReorderItem {
    id: number
    sort_order: number
  }

  export interface ReviewPayload {
    reason?: string | null
  }

  export interface ModerationQuery {
    status: ModerationStatus
    tenant_id: number
    page: number
    per_page: number
  }

  export interface AssetProjection {
    id: number
    media_type: Type
    file_extension: ImageExtension
    mime_type: ImageMimeType
    width: number
    height: number
    checksum_sha256: string
    url: string
  }

  export interface AdministrativeProjection {
    id: number
    establishment_id: number
    revision_id: number
    purpose: Purpose
    is_cover: boolean
    sort_order: number
    alt_text: string | null
    caption: string | null
    moderation_status: ModerationStatus
    review_notes: string | null
    reviewed_at: string | null
    created_at: string
    updated_at: string
    asset: AssetProjection
  }

  export interface PublicProjection {
    id: number
    purpose: Purpose
    is_cover: boolean
    sort_order: number
    alt_text: string
    caption: string | null
    asset: Pick<
      AssetProjection,
      'id' | 'media_type' | 'file_extension' | 'mime_type' | 'width' | 'height' | 'url'
    >
  }
}

export default IMedia
