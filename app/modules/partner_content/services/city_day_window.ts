import { DateTime } from 'luxon'

/**
 * "Today" in a city — the only place timezone arithmetic happens.
 *
 * A city agenda is a question about a local day, and the route already resolved
 * exactly one city, so there is exactly one timezone per request. That is what
 * makes this possible: the boundaries of the local day are computed here, once,
 * and everything downstream compares absolute instants. The repository never
 * sees a zone name, never converts a row and never mixes two clocks — an event
 * ending at 23:30 in `America/Sao_Paulo` still counts as today even when the
 * server's UTC clock has already rolled over, because the comparison is between
 * instants that were derived from the city's calendar.
 *
 * The same `now` that produced the boundaries is the one used for currency, so
 * a request cannot straddle two different "nows" and drop an event that is
 * ending right at that moment.
 */

/** Eight local days: today plus a week of announcements. */
export const CITY_AGENDA_HORIZON_DAYS = 8

export interface CityDayWindow {
  /** The zone the window was actually computed in, after validation. */
  timezone: string
  /** The local calendar day, `YYYY-MM-DD`, the window belongs to. */
  local_date: string
  /** The instant the request was answered at, in UTC. */
  now: string
  /** Local 00:00 today, as an absolute instant. */
  day_start: string
  /** Local 00:00 tomorrow, as an absolute instant. Exclusive. */
  day_end: string
  /** Local 00:00 of `today + horizonDays`, as an absolute instant. Exclusive. */
  horizon_end: string
}

/**
 * An unusable timezone falls back to UTC instead of throwing: a misconfigured
 * city must degrade to a coherent agenda, not to a 500 on a public page.
 */
export function resolveCityZone(timezone: string | null | undefined): string {
  if (!timezone || !timezone.trim()) return 'UTC'
  return DateTime.now().setZone(timezone).isValid ? timezone : 'UTC'
}

export function cityDayWindow(
  now: DateTime,
  timezone: string | null | undefined,
  horizonDays: number = CITY_AGENDA_HORIZON_DAYS
): CityDayWindow {
  const zone = resolveCityZone(timezone)
  const local = now.setZone(zone)

  // `startOf('day')` and the calendar-day additions below are what keep a DST
  // transition from silently shifting the window by an hour: adding days to a
  // local midnight is a calendar operation, adding 24 hours would not be.
  const dayStart = local.startOf('day')
  const dayEnd = dayStart.plus({ days: 1 })
  const horizonEnd = dayStart.plus({ days: Math.max(1, Math.trunc(horizonDays)) })

  return {
    timezone: zone,
    local_date: dayStart.toFormat('yyyy-MM-dd'),
    now: instant(now),
    day_start: instant(dayStart),
    day_end: instant(dayEnd),
    horizon_end: instant(horizonEnd),
  }
}

function instant(value: DateTime): string {
  const iso = value.toUTC().toISO()

  if (!iso) {
    throw new Error('A city agenda window requires a valid instant')
  }

  return iso
}
