import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import EstablishmentRevisionSpecialDay from '#modules/establishments/models/establishment_revision_special_day'
import EstablishmentRevisionSpecialHour from '#modules/establishments/models/establishment_revision_special_hour'
import LucidRepository from '#shared/lucid/lucid_repository'

// Each special-hour row binds 9 values. A 1,000-row chunk uses at most 9,000 of
// PostgreSQL's 65,535 bind parameters, leaving a conservative safety margin.
const SPECIAL_HOUR_INSERT_CHUNK_SIZE = 1_000

export interface SpecialHourRow {
  tenant_id: number
  special_day_id: number
  revision_id: number
  opens_at: string
  closes_at: string
  spans_next_day: boolean
  sort_order: number
}

export default class EstablishmentRevisionSpecialDayRepository extends LucidRepository<
  typeof EstablishmentRevisionSpecialDay
> {
  constructor() {
    super(EstablishmentRevisionSpecialDay)
  }

  async listForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevisionSpecialDay[]> {
    return EstablishmentRevisionSpecialDay.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .preload('intervals', (query) => query.orderBy('sort_order', 'asc'))
      .orderBy('date', 'asc')
  }

  async deleteForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<void> {
    await EstablishmentRevisionSpecialDay.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .delete()
  }

  async createIntervals(rows: SpecialHourRow[], client: TransactionClientContract): Promise<void> {
    await EstablishmentRevisionSpecialHour.createMany(rows, { client })
  }

  /**
   * Copies the special days of one revision, and their intervals, into a
   * freshly cloned revision with a bounded number of statements.
   */
  async copyToRevision(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: TransactionClientContract
  ): Promise<void> {
    const days = await client
      .from('establishment_revision_special_days')
      .where('tenant_id', tenantId)
      .where('revision_id', sourceRevisionId)
      .orderBy('date', 'asc')

    if (days.length === 0) return

    const intervals = await client
      .from('establishment_revision_special_hours')
      .where('tenant_id', tenantId)
      .where('revision_id', sourceRevisionId)
      .whereIn(
        'special_day_id',
        days.map((day) => day.id)
      )
      .orderBy('special_day_id', 'asc')
      .orderBy('sort_order', 'asc')
    const now = new Date()
    const createdDays = await client
      .table('establishment_revision_special_days')
      .insert(
        days.map((day) => ({
          tenant_id: tenantId,
          revision_id: targetRevisionId,
          date: day.date,
          status: day.status,
          note: day.note,
          created_at: now,
          updated_at: now,
        }))
      )
      .returning(['id', 'date'])

    if (intervals.length === 0) return

    const sourceDatesById = new Map(
      days.map((day) => [Number(day.id), this.normalizedDateKey(day.date)])
    )
    const targetDayIdsByDate = new Map(
      createdDays.map((day) => [this.normalizedDateKey(day.date), Number(day.id)])
    )
    const copiedIntervals = intervals.map((interval) => {
      const sourceDate = sourceDatesById.get(Number(interval.special_day_id))
      const targetDayId = sourceDate ? targetDayIdsByDate.get(sourceDate) : undefined
      if (!targetDayId) {
        throw new BadRequestException('Special-hour source is inconsistent')
      }

      return {
        tenant_id: tenantId,
        special_day_id: targetDayId,
        revision_id: targetRevisionId,
        opens_at: interval.opens_at,
        closes_at: interval.closes_at,
        spans_next_day: interval.spans_next_day,
        sort_order: interval.sort_order,
        created_at: now,
        updated_at: now,
      }
    })

    for (
      let offset = 0;
      offset < copiedIntervals.length;
      offset += SPECIAL_HOUR_INSERT_CHUNK_SIZE
    ) {
      await client
        .table('establishment_revision_special_hours')
        .insert(copiedIntervals.slice(offset, offset + SPECIAL_HOUR_INSERT_CHUNK_SIZE))
    }
  }

  private normalizedDateKey(value: unknown): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10)
    return String(value).slice(0, 10)
  }
}
