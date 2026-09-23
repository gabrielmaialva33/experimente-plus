export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'
export type ReportTargetType = 'review' | 'reply' | 'establishment'
export type ReportReason =
  | 'spam'
  | 'offensive'
  | 'inappropriate'
  | 'false_information'
  | 'conflict_of_interest'
  | 'harassment'
  | 'other'

export const reportStatusMeta: Record<ReportStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pendente',
    className: 'border-warning/25 bg-warning/15 text-warning-foreground',
  },
  under_review: {
    label: 'Em análise',
    className: 'border-primary/25 bg-primary-soft text-primary-accent',
  },
  resolved: {
    label: 'Resolvida',
    className: 'border-success/25 bg-success/10 text-success',
  },
  dismissed: {
    label: 'Descartada',
    className: 'border-border bg-muted text-muted-foreground',
  },
}

export const reportReasonLabels: Record<ReportReason, string> = {
  spam: 'Spam',
  offensive: 'Conteúdo ofensivo',
  inappropriate: 'Conteúdo inapropriado',
  false_information: 'Informação falsa',
  conflict_of_interest: 'Conflito de interesse',
  harassment: 'Assédio',
  other: 'Outro motivo',
}

export const reportTargetLabels: Record<ReportTargetType, string> = {
  review: 'Avaliação',
  reply: 'Resposta do parceiro',
  establishment: 'Unidade',
}

/**
 * What a moderator can record as the outcome.
 *
 * Only `content_hidden` has an effect on the content: the service hides the
 * review or the reply when it sees that value. The others are the operation's
 * own description of what was decided, which is why they are a vocabulary here
 * and not an enum the API enforces — the endpoint accepts any short string, and
 * pretending otherwise in this file would be inventing a contract.
 */
export const reportResolutionActions: Array<{
  value: string
  label: string
  /** True when choosing it changes the content, not only the record. */
  hides: boolean
}> = [
  { value: 'content_hidden', label: 'Ocultar o conteúdo', hides: true },
  { value: 'no_violation', label: 'Sem violação', hides: false },
  { value: 'warning_issued', label: 'Autor advertido', hides: false },
  { value: 'duplicate', label: 'Denúncia repetida', hides: false },
]

export function isReportStatus(value: string): value is ReportStatus {
  return value in reportStatusMeta
}

export function isReportReason(value: string): value is ReportReason {
  return value in reportReasonLabels
}

export function isReportTargetType(value: string): value is ReportTargetType {
  return value in reportTargetLabels
}

/**
 * The public address of a reported item, or nothing.
 *
 * Built from the city and establishment slugs because that pair is the public
 * identity (ADR-0016 §6). A report whose target lost its slugs — withdrawn,
 * never published — is shown without a link rather than with a guessed one.
 */
export function targetPublicPath(citySlug: string, establishmentSlug: string): string | null {
  const city = citySlug.trim()
  const slug = establishmentSlug.trim()
  if (!city || !slug) return null

  return `/cidades/${encodeURIComponent(city)}/estabelecimentos/${encodeURIComponent(slug)}`
}

/**
 * Whether a deadline has passed. ADR-0027 gives a report a `due_at` precisely
 * so lateness is observable instead of silent.
 */
export function isOverdue(dueAt: string | null, status: ReportStatus, now = new Date()): boolean {
  if (!dueAt) return false
  if (status === 'resolved' || status === 'dismissed') return false
  const due = new Date(dueAt)
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime()
}

export function formatReportDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}
