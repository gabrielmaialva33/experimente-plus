import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import EstablishmentRevisionHour from '#modules/establishments/models/establishment_revision_hour'
import LucidRepository from '#shared/lucid/lucid_repository'

export interface WeeklyHourRow {
  tenant_id: number
  revision_id: number
  weekday: number
  opens_at: string
  closes_at: string
  spans_next_day: boolean
  sort_order: number
}

export default class EstablishmentRevisionHourRepository extends LucidRepository<
  typeof EstablishmentRevisionHour
> {
  constructor() {
    super(EstablishmentRevisionHour)
  }

  async listForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevisionHour[]> {
    return EstablishmentRevisionHour.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .orderBy('weekday', 'asc')
      .orderBy('sort_order', 'asc')
  }

  async deleteForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<void> {
    await EstablishmentRevisionHour.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .delete()
  }

  async createManyForRevision(
    rows: WeeklyHourRow[],
    client: TransactionClientContract
  ): Promise<void> {
    await EstablishmentRevisionHour.createMany(rows, { client })
  }

  /** Copies the weekly hours of one revision into a freshly cloned revision. */
  async copyToRevision(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: TransactionClientContract
  ): Promise<void> {
    const rows = await client
      .from('establishment_revision_hours')
      .where('tenant_id', tenantId)
      .where('revision_id', sourceRevisionId)
      .orderBy('weekday', 'asc')
      .orderBy('sort_order', 'asc')

    if (rows.length === 0) return
    await client.table('establishment_revision_hours').insert(
      rows.map((row) => ({
        tenant_id: tenantId,
        revision_id: targetRevisionId,
        weekday: row.weekday,
        opens_at: row.opens_at,
        closes_at: row.closes_at,
        spans_next_day: row.spans_next_day,
        sort_order: row.sort_order,
        created_at: new Date(),
        updated_at: new Date(),
      }))
    )
  }
}
