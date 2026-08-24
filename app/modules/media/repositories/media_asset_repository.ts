import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import MediaAsset from '#modules/media/models/media_asset'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class MediaAssetRepository extends LucidRepository<typeof MediaAsset> {
  constructor() {
    super(MediaAsset)
  }

  async findByIdForEstablishment(
    tenantId: number,
    establishmentId: number,
    id: number,
    client?: TransactionClientContract
  ): Promise<MediaAsset | null> {
    const query = client ? MediaAsset.query({ client }) : MediaAsset.query()

    return query
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('id', id)
      .preload('file')
      .first()
  }

  async findLocked(
    tenantId: number,
    establishmentId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<MediaAsset | null> {
    return MediaAsset.query({ client })
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('id', id)
      .preload('file')
      .forUpdate()
      .first()
  }

  async countReferences(mediaAssetId: number, client: TransactionClientContract): Promise<number> {
    const row = await EstablishmentRevisionMedia.query({ client })
      .where('media_asset_id', mediaAssetId)
      .count('* as total')
      .first()

    return Number(row?.$extras.total ?? 0)
  }
}
