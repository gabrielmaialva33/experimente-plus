import { DateTime } from 'luxon'

/**
 * Periods of the partner's "Desempenho" page and the window each one is
 * compared with.
 *
 * Every window is a range of calendar days of the place's city, inclusive on
 * both ends, because the daily analytics aggregates are keyed by that local
 * date. A month is compared with the same stretch of the month before (1–13 of
 * October with 1–13 of September, a whole September with a whole August) and a
 * run of days with as many days right before it.
 */
export const PERFORMANCE_PERIODS = [
  'current_month',
  'previous_month',
  'last_90_days',
  'current_edition',
] as const

export type PerformancePeriodKey = (typeof PERFORMANCE_PERIODS)[number]

export const DEFAULT_PERFORMANCE_PERIOD: PerformancePeriodKey = 'current_month'

/** Inclusive range of local calendar days, as `YYYY-MM-DD`. */
export interface LocalDateRange {
  from: string
  to: string
}

/** The first and last local days of an edition's usage window. */
export interface EditionDays {
  starts_on: string
  ends_on: string
}

export interface PerformanceWindows {
  key: PerformancePeriodKey
  current: LocalDateRange
  previous: LocalDateRange
}

/** Half-open instant bounds `[start, end)` for timestamp columns. */
export interface InstantBounds {
  start: string
  end: string
}

const DAY = (iso: string) => DateTime.fromISO(iso, { zone: 'utc' }).startOf('day')
const ISO = (day: DateTime) => day.toISODate()!

/** An unknown or missing period reads as the default instead of failing the page. */
export function parsePerformancePeriod(value: unknown): PerformancePeriodKey | undefined {
  return typeof value === 'string' && (PERFORMANCE_PERIODS as readonly string[]).includes(value)
    ? (value as PerformancePeriodKey)
    : undefined
}

/** Days in an inclusive range. */
export function rangeLength(range: LocalDateRange): number {
  return DAY(range.to).diff(DAY(range.from), 'days').days + 1
}

/**
 * The current and comparison windows of a period, given the local `today`.
 * The edition period needs an edition whose usage already started; without
 * one it falls back to the current month.
 */
export function performanceWindows(
  requested: PerformancePeriodKey,
  today: string,
  edition: EditionDays | null
): PerformanceWindows {
  const day = DAY(today)
  const key = requested === 'current_edition' && !editionStarted(edition, day) ? null : requested

  switch (key) {
    case 'previous_month': {
      const start = day.startOf('month').minus({ months: 1 })
      const previousStart = start.minus({ months: 1 })
      return {
        key,
        current: { from: ISO(start), to: ISO(start.endOf('month').startOf('day')) },
        previous: {
          from: ISO(previousStart),
          to: ISO(previousStart.endOf('month').startOf('day')),
        },
      }
    }
    case 'last_90_days':
      return {
        key,
        current: { from: ISO(day.minus({ days: 89 })), to: ISO(day) },
        previous: { from: ISO(day.minus({ days: 179 })), to: ISO(day.minus({ days: 90 })) },
      }
    case 'current_edition': {
      const start = DAY(edition!.starts_on)
      const endsOn = DAY(edition!.ends_on)
      const end = endsOn < day ? endsOn : day
      const length = end.diff(start, 'days').days + 1
      const previousEnd = start.minus({ days: 1 })
      return {
        key,
        current: { from: ISO(start), to: ISO(end) },
        previous: { from: ISO(previousEnd.minus({ days: length - 1 })), to: ISO(previousEnd) },
      }
    }
    default: {
      // Month to date, compared with the same days of the month before. A
      // shorter month ends the comparison on its last day (31 March is
      // compared with 1–28 February).
      const start = day.startOf('month')
      const previousStart = start.minus({ months: 1 })
      const previousEndCandidate = previousStart.plus({ days: day.day - 1 })
      const previousMonthEnd = previousStart.endOf('month').startOf('day')
      return {
        key: 'current_month',
        current: { from: ISO(start), to: ISO(day) },
        previous: {
          from: ISO(previousStart),
          to: ISO(
            previousEndCandidate > previousMonthEnd ? previousMonthEnd : previousEndCandidate
          ),
        },
      }
    }
  }
}

/** The instants that open and close a range of local days in `zone`. */
export function instantBounds(range: LocalDateRange, zone: string): InstantBounds {
  const start = DateTime.fromISO(range.from, { zone }).startOf('day')
  const end = DateTime.fromISO(range.to, { zone }).plus({ days: 1 }).startOf('day')
  return { start: start.toUTC().toISO()!, end: end.toUTC().toISO()! }
}

/** A valid IANA zone, or the operation's default when the city has none usable. */
export function performanceZone(zone: string | null | undefined, fallback: string): string {
  return zone && DateTime.now().setZone(zone).isValid ? zone : fallback
}

function editionStarted(edition: EditionDays | null, today: DateTime): boolean {
  return edition !== null && DAY(edition.starts_on) <= today
}
