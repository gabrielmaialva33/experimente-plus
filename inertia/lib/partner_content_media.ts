import { collection, numeric, record, text } from '~/lib/json'

export type PartnerContentMediaStatus = 'pending' | 'approved' | 'rejected' | 'quarantined'

export interface PartnerContentMediaItem {
  id: number
  isCover: boolean
  sortOrder: number
  altText: string
  caption: string | null
  moderationStatus: PartnerContentMediaStatus
  reviewNotes: string | null
  asset: {
    id: number
    url: string
    width: number
    height: number
    mimeType: string
  }
}

function mediaStatus(value: string): PartnerContentMediaStatus {
  return value === 'approved' || value === 'rejected' || value === 'quarantined' ? value : 'pending'
}

export function partnerContentMediaItems(value: unknown): PartnerContentMediaItem[] {
  return collection(value).flatMap((row) => {
    const asset = record(row.asset)
    const id = numeric(row, 'id')
    const url = text(asset, 'url')

    if (id <= 0 || !asset || !url) return []

    return [
      {
        id,
        isCover: row.is_cover === true,
        sortOrder: numeric(row, 'sort_order'),
        altText: text(row, 'alt_text'),
        caption: text(row, 'caption') || null,
        moderationStatus: mediaStatus(text(row, 'moderation_status')),
        reviewNotes: text(row, 'review_notes') || null,
        asset: {
          id: numeric(asset, 'id'),
          url,
          width: numeric(asset, 'width'),
          height: numeric(asset, 'height'),
          mimeType: text(asset, 'mime_type'),
        },
      },
    ]
  })
}

export const partnerContentMediaStatusMeta: Record<
  PartnerContentMediaStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Imagem em análise',
    className: 'border-info/30 bg-info-soft text-info-accent',
  },
  approved: {
    label: 'Imagem aprovada',
    className: 'border-success/25 bg-success-soft text-success-accent',
  },
  rejected: {
    label: 'Imagem recusada',
    className: 'border-destructive/25 bg-destructive-soft text-destructive-accent',
  },
  quarantined: {
    label: 'Imagem em quarentena',
    className: 'border-destructive/25 bg-destructive-soft text-destructive-accent',
  },
}

/**
 * How a moderator's note on an image is drawn. A note on an approved or pending
 * image is context ("Ilustração original do catálogo"), not a fault: only a
 * refusal or a quarantine takes the error colour.
 */
export function partnerContentMediaNoteClassName(status: PartnerContentMediaStatus): string {
  return status === 'rejected' || status === 'quarantined'
    ? 'bg-destructive/10 text-destructive'
    : 'bg-muted text-muted-foreground'
}
