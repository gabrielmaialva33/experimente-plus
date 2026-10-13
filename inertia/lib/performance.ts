/**
 * The partner's "Desempenho" page of one place: its props, as the server sends
 * them, and the words and numbers the page builds from them.
 *
 * Every number is an aggregate the server counted; the page only formats and
 * compares. The sales figure is an estimate and is always named so.
 */

export type PerformancePeriodKey =
  'current_month' | 'previous_month' | 'last_90_days' | 'current_edition'

export type PerformanceComparison = { current: number; previous: number }

export type PerformanceClickChannel = 'route' | 'whatsapp' | 'phone' | 'website'

export type PerformanceEstimate =
  | {
      status: 'available'
      average_ticket_cents: number
      current_cents: number
      previous_cents: number
    }
  | { status: 'pending_review' }
  | { status: 'missing'; field_available: boolean }

export type EstablishmentPerformance = {
  establishment: {
    id: number
    name: string
    organization_id: number
    organization_name: string
    published: boolean
  }
  period: {
    key: PerformancePeriodKey
    from: string
    to: string
    previous_from: string
    previous_to: string
    days: number
    previous_days: number
  }
  periods: PerformancePeriodKey[]
  edition: { name: string; starts_on: string; ends_on: string } | null
  metrics: {
    impressions: PerformanceComparison
    views: PerformanceComparison
    clicks: (PerformanceComparison & { channel: PerformanceClickChannel; published: boolean })[]
    new_followers: PerformanceComparison
    new_favorites: PerformanceComparison
    redemptions: PerformanceComparison
    reviews: {
      count: PerformanceComparison
      average: { current: number | null; previous: number | null }
    }
  }
  estimate: PerformanceEstimate
  trend: { date: string; impressions: number; views: number; clicks: number }[]
}

export const PERFORMANCE_PERIOD_LABELS: Record<PerformancePeriodKey, string> = {
  current_month: 'Este mês',
  previous_month: 'Mês passado',
  last_90_days: 'Últimos 90 dias',
  current_edition: 'Edição atual',
}

export const CLICK_CHANNEL_LABELS: Record<PerformanceClickChannel, string> = {
  route: 'Cliques em rota',
  whatsapp: 'Cliques no WhatsApp',
  phone: 'Cliques no telefone',
  website: 'Cliques no site',
}

const MONTHS = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
]

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const oneDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const reais = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const reaisWithCents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** 1.234; from 10 mil up, 12,3 mil. */
export function formatCount(value: number): string {
  return value >= 10_000 ? compact.format(value) : integer.format(value)
}

/** Whole reais, for the estimate: R$ 8.500. */
export function formatEstimate(cents: number): string {
  return reais.format(Math.round(cents / 100))
}

/** Reais and cents, for the ticket the estimate uses: R$ 42,50. */
export function formatTicket(cents: number): string {
  return reaisWithCents.format(cents / 100)
}

/** 4,5. */
export function formatRating(value: number): string {
  return oneDecimal.format(value)
}

function parts(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month: MONTHS[month - 1], day }
}

/**
 * A range of days as a person says it: "1 a 13 de out. de 2026",
 * "1 de set. a 13 de out. de 2026", or with both years when they differ.
 */
export function formatDayRange(from: string, to: string): string {
  const start = parts(from)
  const end = parts(to)
  const endLabel = `${end.day} de ${end.month} de ${end.year}`

  if (from === to) return endLabel
  if (start.year !== end.year)
    return `${start.day} de ${start.month} de ${start.year} a ${endLabel}`
  if (start.month !== end.month) return `${start.day} de ${start.month} a ${endLabel}`
  return `${start.day} a ${endLabel}`
}

/** "13 out.", for the axis of the daily chart. */
export function formatDay(iso: string): string {
  const { day, month } = parts(iso)
  return `${day} ${month}`
}

export type ChangeDirection = 'up' | 'down' | 'same' | 'none'

export interface MetricChange {
  direction: ChangeDirection
  /** Short, shown next to the number. */
  label: string
  /** The full sentence a screen reader reads instead. */
  description: string
}

/**
 * How a number moved against the period it is compared with. Without a
 * previous value there is no percentage to give, only what it was.
 */
export function describeChange(
  current: number,
  previous: number,
  format: (value: number) => string = formatCount
): MetricChange {
  const before = format(previous)

  if (current === 0 && previous === 0) {
    return {
      direction: 'none',
      label: 'Sem registros nos dois períodos',
      description: 'Sem registros neste período nem no anterior.',
    }
  }
  if (current === previous) {
    return {
      direction: 'same',
      label: `Igual · antes ${before}`,
      description: `Igual ao período anterior, que teve ${before}.`,
    }
  }
  if (previous === 0) {
    return {
      direction: 'up',
      label: `Antes ${before}`,
      description: `Aumento: o período anterior teve ${before}.`,
    }
  }

  const change = ((current - previous) / previous) * 100
  const magnitude = Math.abs(change)
  const percent = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: magnitude < 10 ? 1 : 0,
  }).format(magnitude)
  const up = change > 0

  return {
    direction: up ? 'up' : 'down',
    label: `${up ? '+' : '−'}${percent}% · antes ${before}`,
    description: `${up ? 'Aumento' : 'Queda'} de ${percent}% em relação ao período anterior, que teve ${before}.`,
  }
}

/** The average rating against the one before, in points of the five-star scale. */
export function describeRatingChange(
  current: number | null,
  previous: number | null
): MetricChange {
  if (current === null && previous === null) {
    return {
      direction: 'none',
      label: 'Sem avaliações nos dois períodos',
      description: 'Sem avaliações neste período nem no anterior.',
    }
  }
  if (current === null) {
    return {
      direction: 'none',
      label: `Sem nota no período · antes ${formatRating(previous!)}`,
      description: `Nenhuma avaliação neste período; a nota média do anterior foi ${formatRating(previous!)}.`,
    }
  }
  if (previous === null) {
    return {
      direction: 'none',
      label: 'Sem nota no período anterior',
      description: 'O período anterior não teve avaliações para comparar.',
    }
  }

  const difference = Math.round((current - previous) * 10) / 10
  if (difference === 0) {
    return {
      direction: 'same',
      label: `Igual · antes ${formatRating(previous)}`,
      description: `Igual à nota média do período anterior, ${formatRating(previous)}.`,
    }
  }

  const up = difference > 0
  const points = Math.abs(difference) >= 2 ? 'pontos' : 'ponto'
  return {
    direction: up ? 'up' : 'down',
    label: `${up ? '+' : '−'}${formatRating(Math.abs(difference))} · antes ${formatRating(previous)}`,
    description: `${up ? 'Subiu' : 'Caiu'} ${formatRating(Math.abs(difference))} ${points} em relação à nota média do período anterior, ${formatRating(previous)}.`,
  }
}

/** Whether anything at all happened in the chosen period. */
export function hasActivity(performance: EstablishmentPerformance): boolean {
  const { metrics } = performance
  return [
    metrics.impressions,
    metrics.views,
    metrics.new_followers,
    metrics.new_favorites,
    metrics.redemptions,
    metrics.reviews.count,
    ...metrics.clicks,
  ].some((metric) => metric.current > 0)
}

export function performancePath(establishmentId: number, period?: PerformancePeriodKey): string {
  const path = `/portal/establishments/${establishmentId}/performance`
  return period ? `${path}?period=${period}` : path
}
