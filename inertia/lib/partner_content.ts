export type PartnerContentPath = 'experiences' | 'events' | 'showcase-items'
export type PartnerContentStatus = 'draft' | 'pending_review' | 'published' | 'archived'

export const partnerContentKinds: Array<{
  path: PartnerContentPath
  label: string
  singular: string
  description: string
}> = [
  {
    path: 'experiences',
    label: 'Experiências',
    singular: 'experiência',
    description: 'Atividades e vivências próprias do estabelecimento.',
  },
  {
    path: 'events',
    label: 'Eventos',
    singular: 'evento',
    description: 'Programação com início e fim definidos no fuso da cidade.',
  },
  {
    path: 'showcase-items',
    label: 'Vitrine',
    singular: 'item de vitrine',
    description: 'Itens informativos, com preço opcional e sem checkout.',
  },
]

export const partnerContentStatusMeta: Record<
  PartnerContentStatus,
  { label: string; className: string }
> = {
  draft: {
    label: 'Rascunho',
    className: 'border-border bg-muted text-muted-foreground',
  },
  pending_review: {
    label: 'Em análise',
    className: 'border-warning/25 bg-warning/15 text-warning-foreground',
  },
  published: {
    label: 'Publicado',
    className: 'border-success/25 bg-success/10 text-success',
  },
  archived: {
    label: 'Arquivado',
    className: 'border-border bg-muted/60 text-muted-foreground',
  },
}

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function partsInTimeZone(date: Date, timeZone: string): LocalParts | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? Number.NaN)
    const result = {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      hour: value('hour'),
      minute: value('minute'),
    }

    return Object.values(result).every(Number.isFinite) ? result : null
  } catch {
    return null
  }
}

function parseLocal(value: string): LocalParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  }
}

function sameParts(left: LocalParts | null, right: LocalParts): boolean {
  return (
    left !== null &&
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  )
}

/**
 * Resolves a browser datetime-local value in the establishment city's IANA
 * timezone. The browser timezone is deliberately irrelevant (ADR-0028).
 */
export function zonedLocalToIso(value: string, timeZone: string): string | null {
  const desired = parseLocal(value)
  if (!desired) return null

  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute
  )
  let instant = desiredAsUtc

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = partsInTimeZone(new Date(instant), timeZone)
    if (!observed) return null
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute
    )
    const delta = desiredAsUtc - observedAsUtc
    instant += delta
    if (delta === 0) break
  }

  if (!sameParts(partsInTimeZone(new Date(instant), timeZone), desired)) return null
  return new Date(instant).toISOString()
}

export function isoToZonedLocal(value: string | null, timeZone: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = partsInTimeZone(date, timeZone)
  if (!parts) return ''

  const two = (part: number) => String(part).padStart(2, '0')
  return (
    String(parts.year) +
    '-' +
    two(parts.month) +
    '-' +
    two(parts.day) +
    'T' +
    two(parts.hour) +
    ':' +
    two(parts.minute)
  )
}

export function formatPartnerContentDate(
  value: string | null,
  timeZone?: string | null
): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || 'UTC',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(date)
  }
}

export function reaisToCents(value: string): number | null {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

export function centsToReais(value: number | null): string {
  return value === null ? '' : (value / 100).toFixed(2).replace('.', ',')
}
