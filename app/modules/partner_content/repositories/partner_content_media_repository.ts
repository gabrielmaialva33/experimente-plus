import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import PartnerContentMedia from '#modules/partner_content/models/partner_content_media'
import LucidRepository from '#shared/lucid/lucid_repository'

const TARGET_COLUMN = {
  experience: 'experience_id',
  event: 'event_id',
  showcase_item: 'showcase_item_id',
} as const

export default class PartnerContentMediaRepository extends LucidRepository<
  typeof PartnerContentMedia
> {
  constructor() {
    super(PartnerContentMedia)
  }

  targetColumn(kind: IPartnerContent.ContentKind) {
    return TARGET_COLUMN[kind]
  }

  targetAttributes(kind: IPartnerContent.ContentKind, contentId: number) {
    return {
      experience_id: kind === 'experience' ? contentId : null,
      event_id: kind === 'event' ? contentId : null,
      showcase_item_id: kind === 'showcase_item' ? contentId : null,
    }
  }

  async listForContent(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    establishmentId: number,
    contentId: number,
    client?: TransactionClientContract,
    approvedOnly = false
  ): Promise<PartnerContentMedia[]> {
    const query = PartnerContentMedia.query({ client })
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where(this.targetColumn(kind), contentId)
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .orderBy('is_cover', 'desc')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')

    if (approvedOnly) query.where('moderation_status', 'approved')
    return query
  }

  async listForContents(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    contentIds: readonly number[],
    approvedOnly = false
  ): Promise<PartnerContentMedia[]> {
    if (contentIds.length === 0) return []

    const query = PartnerContentMedia.query()
      .where('tenant_id', tenantId)
      .whereIn(this.targetColumn(kind), [...new Set(contentIds)])
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .orderBy(this.targetColumn(kind), 'asc')
      .orderBy('is_cover', 'desc')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')

    if (approvedOnly) query.where('moderation_status', 'approved')
    return query
  }

  async countForContent(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    contentId: number,
    client: TransactionClientContract
  ): Promise<number> {
    const row = await PartnerContentMedia.query({ client })
      .where('tenant_id', tenantId)
      .where(this.targetColumn(kind), contentId)
      .count('* as total')
      .first()

    return Number(row?.$extras.total ?? 0)
  }

  async nextSortOrder(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    contentId: number,
    client: TransactionClientContract
  ): Promise<number> {
    const row = await PartnerContentMedia.query({ client })
      .where('tenant_id', tenantId)
      .where(this.targetColumn(kind), contentId)
      .max('sort_order as max_sort_order')
      .first()

    return Number(row?.$extras.max_sort_order ?? -1) + 1
  }

  async clearCover(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    contentId: number,
    client: TransactionClientContract,
    exceptId?: number
  ): Promise<void> {
    const query = PartnerContentMedia.query({ client })
      .where('tenant_id', tenantId)
      .where(this.targetColumn(kind), contentId)
      .where('is_cover', true)

    if (exceptId !== undefined) query.whereNot('id', exceptId)
    await query.update({ is_cover: false })
  }

  async findLockedForContent(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    establishmentId: number,
    contentId: number,
    mediaId: number,
    client: TransactionClientContract
  ): Promise<PartnerContentMedia | null> {
    return PartnerContentMedia.query({ client })
      .where('id', mediaId)
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where(this.targetColumn(kind), contentId)
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .forUpdate()
      .first()
  }

  async findLockedForModeration(
    kind: IPartnerContent.ContentKind,
    tenantId: number,
    contentId: number,
    mediaId: number,
    client: TransactionClientContract
  ): Promise<PartnerContentMedia | null> {
    return PartnerContentMedia.query({ client })
      .where('id', mediaId)
      .where('tenant_id', tenantId)
      .where(this.targetColumn(kind), contentId)
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .forUpdate()
      .first()
  }
}
