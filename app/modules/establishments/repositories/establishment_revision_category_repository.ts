import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import EstablishmentRevisionCategory from '#modules/establishments/models/establishment_revision_category'
import LucidRepository from '#shared/lucid/lucid_repository'

export interface RevisionCategoryRow {
  tenant_id: number
  revision_id: number
  category_id: number
  is_primary: boolean
  sort_order: number
}

export default class EstablishmentRevisionCategoryRepository extends LucidRepository<
  typeof EstablishmentRevisionCategory
> {
  constructor() {
    super(EstablishmentRevisionCategory)
  }

  async listForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevisionCategory[]> {
    return EstablishmentRevisionCategory.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .preload('category')
      .orderBy('is_primary', 'desc')
      .orderBy('sort_order', 'asc')
  }

  async findPrimaryForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevisionCategory | null> {
    return EstablishmentRevisionCategory.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .where('is_primary', true)
      .first()
  }

  async deleteForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<void> {
    await EstablishmentRevisionCategory.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .delete()
  }

  async createManyForRevision(
    rows: RevisionCategoryRow[],
    client: TransactionClientContract
  ): Promise<void> {
    await EstablishmentRevisionCategory.createMany(rows, { client })
  }

  /** Copies the category selection of one revision into a freshly cloned revision. */
  async copyToRevision(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: TransactionClientContract
  ): Promise<void> {
    const rows = await client
      .from('establishment_revision_categories')
      .where('tenant_id', tenantId)
      .where('revision_id', sourceRevisionId)
      .orderBy('sort_order', 'asc')

    if (rows.length === 0) return
    await client.table('establishment_revision_categories').insert(
      rows.map((row) => ({
        tenant_id: tenantId,
        revision_id: targetRevisionId,
        category_id: row.category_id,
        is_primary: row.is_primary,
        sort_order: row.sort_order,
        created_at: new Date(),
        updated_at: new Date(),
      }))
    )
  }
}
