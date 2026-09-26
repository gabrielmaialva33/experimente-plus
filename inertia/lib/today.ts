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
