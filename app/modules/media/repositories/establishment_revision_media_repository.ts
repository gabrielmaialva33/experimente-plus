import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type IMedia from '#modules/media/interfaces/media_interface'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class EstablishmentRevisionMediaRepository extends LucidRepository<
  typeof EstablishmentRevisionMedia
> {
  constructor() {
    super(EstablishmentRevisionMedia)
  }

  async listForRevision(
    tenantId: number,
    establishmentId: number,
    revisionId: number,
    client?: TransactionClientContract
  ): Promise<EstablishmentRevisionMedia[]> {
    const query = client
      ? EstablishmentRevisionMedia.query({ client })
      : EstablishmentRevisionMedia.query()

    return query
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('revision_id', revisionId)
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
  }

  async listApprovedForRevision(
    tenantId: number,
    establishmentId: number,
    revisionId: number
  ): Promise<EstablishmentRevisionMedia[]> {
    return EstablishmentRevisionMedia.query()
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('revision_id', revisionId)
      .where('moderation_status', 'approved')
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .orderBy('is_cover', 'desc')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
  }

  async findByIdWithDetails(id: number): Promise<EstablishmentRevisionMedia | null> {
    return EstablishmentRevisionMedia.query()
      .where('id', id)
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .preload('revision', (revisionQuery) => revisionQuery.preload('establishment'))
      .first()
  }

  async lockForRevision(
    tenantId: number,
    establishmentId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevisionMedia[]> {
    return EstablishmentRevisionMedia.query({ client })
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('revision_id', revisionId)
      .orderBy('id', 'asc')
      .forUpdate()
  }

  async findLockedForRevision(
    tenantId: number,
    establishmentId: number,
    revisionId: number,
    id: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevisionMedia | null> {
    return EstablishmentRevisionMedia.query({ client })
      .where('tenant_id', tenantId)
      .where('establishment_id', establishmentId)
      .where('revision_id', revisionId)
      .where('id', id)
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .forUpdate()
      .first()
  }

  async findLockedForModeration(
    id: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevisionMedia | null> {
    return EstablishmentRevisionMedia.query({ client })
      .where('id', id)
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .preload('revision')
      .forUpdate()
      .first()
  }

  async countForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<number> {
    const row = await EstablishmentRevisionMedia.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .count('* as total')
      .first()

    return Number(row?.$extras.total ?? 0)
  }

  async nextSortOrder(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<number> {
    const row = await EstablishmentRevisionMedia.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .max('sort_order as max_sort_order')
      .first()

    return Number(row?.$extras.max_sort_order ?? -1) + 1
  }

  async clearCover(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract,
    exceptId?: number
  ): Promise<void> {
    const query = EstablishmentRevisionMedia.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .where('is_cover', true)

    if (exceptId !== undefined) {
      query.whereNot('id', exceptId)
    }

    await query.update({ is_cover: false })
  }

  async listForModeration(query: IMedia.ModerationQuery) {
    const rows = EstablishmentRevisionMedia.query()
      .where('tenant_id', query.tenant_id)
      .where('moderation_status', query.status)
      .preload('asset', (assetQuery) => assetQuery.preload('file'))
      .preload('revision', (revisionQuery) => revisionQuery.preload('establishment'))
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')

    return rows.paginate(query.page, query.per_page)
  }
}
