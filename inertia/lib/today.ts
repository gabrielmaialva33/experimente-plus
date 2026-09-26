/**
 * The operation runs on Brasília time; pinning the zone keeps the server render
 * and the browser on the same day and greeting.
 */
const TIME_ZONE = 'America/Sao_Paulo'

const overlineFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIME_ZONE,
})

const hourFormat = new Intl.DateTimeFormat('pt-BR', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
})

/** "sábado, 26 de setembro" — the overline above a landing screen's title. */
export function todayOverline(now: Date = new Date()): string {
  return overlineFormat.format(now)
}

/** "Bom dia", "Boa tarde" or "Boa noite", by the hour in Brasília. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(hourFormat.format(now))
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
})

const dayMonthFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: TIME_ZONE,
})

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
})

function parse(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "Hoje, 11:13" for today in Brasília, otherwise "26/09, 09:20". */
export function receivedLabel(value: string | null, now: Date = new Date()): string | null {
  const date = parse(value)
  if (!date) return null
  const day =
    dayKeyFormat.format(date) === dayKeyFormat.format(now) ? 'Hoje' : dayMonthFormat.format(date)
  return `${day}, ${timeFormat.format(date)}`
}

/** "01/10": a deadline, read at a glance. */
export function dayMonthLabel(value: string | null): string | null {
  const date = parse(value)
  return date ? dayMonthFormat.format(date) : null
}
