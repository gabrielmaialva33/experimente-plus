import { centsToReais, formatPartnerContentDate } from '~/lib/partner_content'

/** One act in the history of a content item, as the admin API returns it. */
export interface PartnerContentEvent {
  id: number
  action: string
  fromStatus: string | null
  toStatus: string | null
  actorName: string | null
  changes: Record<string, { from: unknown; to: unknown }>
  republished: boolean
  createdAt: string
}

export const partnerContentEventLabels: Record<string, string> = {
  created: 'Criado',
  updated: 'Editado pelo parceiro',
  submitted: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Recusado',
  archived: 'Arquivado',
  admin_edited: 'Corrigido pela moderação',
}

const fieldLabels: Record<string, string> = {
  title: 'Título',
  description: 'Descrição',
  starts_at: 'Início',
  ends_at: 'Fim',
  informational_price_cents: 'Preço informativo',
}

/** Reads the API payload defensively: a missing field renders as less, never as a crash. */
export function partnerContentEvents(value: unknown): PartnerContentEvent[] {
  const rows = (value as { data?: unknown })?.data
  if (!Array.isArray(rows)) return []

  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const entry = row as Record<string, unknown>
    const actor = entry.actor as { full_name?: unknown } | null
    const metadata = entry.metadata as { republished?: unknown } | null
    const changes =
      entry.changes && typeof entry.changes === 'object'
        ? (entry.changes as PartnerContentEvent['changes'])
        : {}

    return [
      {
        id: Number(entry.id),
        action: String(entry.action ?? ''),
        fromStatus: typeof entry.from_status === 'string' ? entry.from_status : null,
        toStatus: typeof entry.to_status === 'string' ? entry.to_status : null,
        actorName: actor && typeof actor.full_name === 'string' ? actor.full_name : null,
        changes,
        republished: metadata?.republished === true,
        createdAt: String(entry.created_at ?? ''),
      },
    ]
  })
}

function display(field: string, value: unknown, timeZone: string | null): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'starts_at' || field === 'ends_at') {
    return formatPartnerContentDate(String(value), timeZone) ?? String(value)
  }
  if (field === 'informational_price_cents' && typeof value === 'number') {
    return 'R$ ' + centsToReais(value)
  }
  return String(value)
}

/** "Título: antes → depois", one line per field that moved. */
export function describeChanges(
  changes: PartnerContentEvent['changes'],
  timeZone: string | null
): string[] {
  return Object.entries(changes).map(
    ([field, change]) =>
      `${fieldLabels[field] ?? field}: ${display(field, change.from, timeZone)} → ${display(
        field,
        change.to,
        timeZone
      )}`
  )
}
