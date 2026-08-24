import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import EstablishmentRevisionHour from '#modules/establishments/models/establishment_revision_hour'
import EstablishmentRevisionSpecialDay from '#modules/establishments/models/establishment_revision_special_day'
import EstablishmentRevisionSpecialHour from '#modules/establishments/models/establishment_revision_special_hour'
import EstablishmentAccessService from '#modules/establishments/services/establishment_access_service'
import EstablishmentAuditService from '#modules/establishments/services/establishment_audit_service'
import type User from '#modules/users/models/user'

type NormalizedInterval = {
  opens_at: string
  closes_at: string
  spans_next_day: boolean
  sort_order: number
  start: number
  end: number
}

@inject()
export default class EstablishmentHoursService {
  constructor(
    private accessService: EstablishmentAccessService,
    private auditService: EstablishmentAuditService
  ) {}

  async replaceWeekly(
    tenantId: number,
    establishmentId: number,
    actor: User,
    payload: IEstablishment.WeeklyHourPayload[]
  ) {
    const normalized = payload.map((item, index) => {
      if (!Number.isInteger(item.weekday) || item.weekday < 0 || item.weekday > 6) {
        throw new BadRequestException('Weekday must be between 0 and 6')
      }
      const interval = this.normalizeInterval(item, item.weekday * 1440, index)
      return { ...interval, weekday: item.weekday }
    })
    this.assertNoWeeklyOverlap(normalized)

    const hours = await db.transaction(async (client) => {
      const { revision } = await this.accessService.getEditable(
        tenantId,
        establishmentId,
        actor,
        client
      )

      await EstablishmentRevisionHour.query({ client })
        .where('tenant_id', tenantId)
        .where('revision_id', revision.id)
        .delete()

      if (normalized.length > 0) {
        await EstablishmentRevisionHour.createMany(
          normalized.map((item) => ({
            tenant_id: tenantId,
            revision_id: revision.id,
            weekday: item.weekday,
            opens_at: item.opens_at,
            closes_at: item.closes_at,
            spans_next_day: item.spans_next_day,
            sort_order: item.sort_order,
          })),
          { client }
        )
      }

      return EstablishmentRevisionHour.query({ client })
        .where('tenant_id', tenantId)
        .where('revision_id', revision.id)
        .orderBy('weekday', 'asc')
        .orderBy('sort_order', 'asc')
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'update',
      resourceId: establishmentId,
      metadata: { section: 'weekly_hours', count: hours.length },
    })

    return hours
  }

  async replaceSpecialDays(
    tenantId: number,
    establishmentId: number,
    actor: User,
    payload: IEstablishment.SpecialDayPayload[]
  ) {
    const dates = payload.map((item) => item.date)
    if (new Set(dates).size !== dates.length) {
      throw new BadRequestException('Special dates must be unique')
    }

    const normalized = payload.map((item) => {
      const date = this.parseDate(item.date)
      const intervals = (item.intervals ?? []).map((interval, index) =>
        this.normalizeInterval(interval, Math.floor(date.toMillis() / 86_400_000) * 1440, index)
      )

      if (item.status === 'closed' && intervals.length > 0) {
        throw new BadRequestException('Closed special days cannot contain intervals')
      }
      if (item.status === 'custom_hours' && intervals.length === 0) {
        throw new BadRequestException('Custom special days require at least one interval')
      }

      return {
        date: item.date,
        status: item.status,
        note: item.note?.trim() || null,
        intervals,
      }
    })
    this.assertNoOverlap(normalized.flatMap((item) => item.intervals))

    const days = await db.transaction(async (client) => {
      const { revision } = await this.accessService.getEditable(
        tenantId,
        establishmentId,
        actor,
        client
      )

      await EstablishmentRevisionSpecialDay.query({ client })
        .where('tenant_id', tenantId)
        .where('revision_id', revision.id)
        .delete()

      for (const item of normalized) {
        const day = await EstablishmentRevisionSpecialDay.create(
          {
            tenant_id: tenantId,
            revision_id: revision.id,
            date: item.date,
            status: item.status,
            note: item.note,
          },
          { client }
        )

        if (item.intervals.length > 0) {
          await EstablishmentRevisionSpecialHour.createMany(
            item.intervals.map((interval) => ({
              tenant_id: tenantId,
              special_day_id: day.id,
              revision_id: revision.id,
              opens_at: interval.opens_at,
              closes_at: interval.closes_at,
              spans_next_day: interval.spans_next_day,
              sort_order: interval.sort_order,
            })),
            { client }
          )
        }
      }

      return EstablishmentRevisionSpecialDay.query({ client })
        .where('tenant_id', tenantId)
        .where('revision_id', revision.id)
        .preload('intervals', (query) => query.orderBy('sort_order', 'asc'))
        .orderBy('date', 'asc')
    })

    await this.auditService.log({
      actorId: actor.id,
      action: 'update',
      resourceId: establishmentId,
      metadata: { section: 'special_hours', count: days.length },
    })

    return days
  }

  private normalizeInterval(
    interval: IEstablishment.HourIntervalPayload,
    baseMinutes: number,
    fallbackSortOrder: number
  ): NormalizedInterval {
    const opens = this.parseTime(interval.opens_at)
    const closes = this.parseTime(interval.closes_at)
    const spansNextDay = interval.spans_next_day ?? false

    if (opens === closes) {
      throw new BadRequestException('Opening and closing times must differ')
    }
    if (!spansNextDay && opens > closes) {
      throw new BadRequestException('An overnight interval must set spans_next_day')
    }
    if (spansNextDay && opens < closes) {
      throw new BadRequestException('A same-day interval cannot set spans_next_day')
    }

    return {
      opens_at: this.formatTime(opens),
      closes_at: this.formatTime(closes),
      spans_next_day: spansNextDay,
      sort_order: interval.sort_order ?? fallbackSortOrder,
      start: baseMinutes + opens,
      end: baseMinutes + (spansNextDay ? 1440 + closes : closes),
    }
  }

  private assertNoWeeklyOverlap(intervals: Array<NormalizedInterval & { weekday: number }>): void {
    const weekMinutes = 7 * 1440
    const segments: Array<{ start: number; end: number }> = []

    for (const interval of intervals) {
      if (interval.end <= weekMinutes) {
        segments.push({ start: interval.start, end: interval.end })
      } else {
        segments.push({ start: interval.start, end: weekMinutes })
        segments.push({ start: 0, end: interval.end - weekMinutes })
      }
    }

    this.assertNoOverlap(segments)
  }

  private assertNoOverlap(intervals: Array<{ start: number; end: number }>): void {
    const sorted = [...intervals].sort((left, right) => left.start - right.start)
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].start < sorted[index - 1].end) {
        throw new BadRequestException('Opening-hour intervals cannot overlap')
      }
    }
  }

  private parseTime(value: string): number {
    const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
    if (!match) {
      throw new BadRequestException('Time must use HH:mm format')
    }
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours > 23 || minutes > 59) {
      throw new BadRequestException('Time is outside the valid range')
    }
    return hours * 60 + minutes
  }

  private formatTime(value: number): string {
    const hours = Math.floor(value / 60)
    const minutes = value % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  private parseDate(value: string): DateTime {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Special date must use YYYY-MM-DD format')
    }
    const date = DateTime.fromISO(value, { zone: 'utc' })
    if (!date.isValid || date.toISODate() !== value) {
      throw new BadRequestException('Special date is invalid')
    }
    return date
  }
}
