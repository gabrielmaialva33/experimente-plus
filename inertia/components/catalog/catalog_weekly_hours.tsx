import { useEffect, useState } from 'react'

import { weekdayLabel, type CatalogHour } from '~/lib/catalog'
import { cn } from '~/lib/utils'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Presentation only: never recalculates the server's is_open_now or availability. */
export function currentWeekday(timeZone: string | null, now = new Date()): number | null {
  if (!timeZone) return null
  try {
    const label = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(now)
    const index = weekdays.indexOf(label)
    return index < 0 ? null : index
  } catch {
    return null
  }
}

export function CatalogWeeklyHours({
  hours,
  timeZone,
}: {
  hours: CatalogHour[]
  timeZone: string | null
}) {
  // Null on SSR and initial hydration avoids a device/server date mismatch.
  const [today, setToday] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setToday(currentWeekday(timeZone))
    update()
    const timer = window.setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [timeZone])

  return (
    <div className="mt-5 divide-y overflow-hidden rounded-md border bg-card">
      {weekdays.map((_, weekday) => {
        const intervals = hours
          .filter((hour) => hour.weekday === weekday)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        const isToday = weekday === today
        return (
          <div
            key={weekday}
            aria-current={isToday ? 'date' : undefined}
            className={cn(
              'grid gap-1 border-l-4 px-4 py-3 text-sm sm:grid-cols-[12rem_1fr] sm:gap-4',
              isToday
                ? 'border-l-temporal-emphasis-border bg-temporal-emphasis text-temporal-emphasis-foreground'
                : 'border-l-transparent'
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              {weekdayLabel(weekday)}
              {isToday ? <span className="text-xs font-bold">Hoje</span> : null}
            </span>
            <span className={cn('sm:text-end', !isToday && 'text-muted-foreground')}>
              {intervals.length === 0
                ? 'Fechado'
                : intervals
                    .map(
                      (interval) =>
                        `${interval.opensAt}–${interval.closesAt}${interval.spansNextDay ? ' (+1 dia)' : ''}`
                    )
                    .join(' · ')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
