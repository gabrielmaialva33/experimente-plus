import type { DateTime } from 'luxon'

/** The timezone an edition falls back to when its city carries none. */
export const DEFAULT_BENEFIT_TIMEZONE = 'America/Sao_Paulo'

/**
 * The bit of `available_weekdays_mask` for a local day: Sunday is 1, Monday 2,
 * and so on to Saturday, 64 — the order of PostgreSQL's `dow`. Luxon numbers
 * the week from Monday (1) to Sunday (7), so Sunday wraps to the first bit.
 */
export function weekdayBit(local: DateTime): number {
  return 1 << (local.weekday % 7)
}

export interface OfferSchedule {
  available_weekdays_mask: number
  daily_start_time: string | null
  daily_end_time: string | null
  starts_at: DateTime | null
  ends_at: DateTime | null
}

export interface EditionUsageWindow {
  usage_starts_at: DateTime
  usage_ends_at: DateTime
}

/** `HH:mm` of the offer's daily window as a moment of the given local day. */
function atLocalTime(day: DateTime, time: string): DateTime {
  const [hour, minute] = time.split(':').map(Number)
  return day.set({ hour, minute, second: 0, millisecond: 0 })
}

/**
 * Whether the offer can still be used at some moment between `now` and the end
 * of the local day — "Vale hoje".
 *
 * It asks the same questions redemption asks of one instant (the edition's and
 * the offer's windows, the weekday mask in the edition city's timezone, the
 * daily window by the minute) of what is left of today instead: an offer for
 * lunch is no longer "valid today" at nine in the evening, and one that starts
 * at six tonight already is in the morning. The statuses of edition, offer and
 * establishment are the caller's: this is the schedule alone.
 */
export function usableLaterToday(
  offer: OfferSchedule,
  edition: EditionUsageWindow,
  timezone: string,
  now: DateTime
): boolean {
  const local = now.setZone(timezone)
  if (!local.isValid) return false
  if ((offer.available_weekdays_mask & weekdayBit(local)) === 0) return false

  const startOfDay = local.startOf('day')
  const starts = [local, edition.usage_starts_at]
  const ends = [local.endOf('day'), edition.usage_ends_at]
  if (offer.starts_at) starts.push(offer.starts_at)
  if (offer.ends_at) ends.push(offer.ends_at)
  if (offer.daily_start_time && offer.daily_end_time) {
    starts.push(atLocalTime(startOfDay, offer.daily_start_time))
    // Redemption compares `HH:mm`, so the closing minute is usable to its last second.
    ends.push(atLocalTime(startOfDay, offer.daily_end_time).endOf('minute'))
  }

  const opens = Math.max(...starts.map((moment) => moment.toMillis()))
  const closes = Math.min(...ends.map((moment) => moment.toMillis()))
  return opens <= closes
}
