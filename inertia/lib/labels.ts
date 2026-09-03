/**
 * pt-BR presentation labels for domain values shared across surfaces.
 *
 * Establishment revision/moderation statuses stay owned by
 * `~/lib/establishment_editor` (`getRevisionStatusMeta`); this module only
 * delegates so there is a single source for that copy.
 */
import { getRevisionStatusMeta } from '~/lib/establishment_editor'

export const ORGANIZATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending_review: 'Em análise',
  changes_requested: 'Correções solicitadas',
  active: 'Ativa',
  rejected: 'Rejeitada',
  suspended: 'Suspensa',
  archived: 'Arquivada',
}

export function organizationStatusLabel(status: string): string {
  return ORGANIZATION_STATUS_LABELS[status] ?? status
}

export const ORGANIZATION_ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  editor: 'Editor',
  analyst: 'Analista',
  member: 'Membro',
}

export function organizationRoleLabel(role: string | null | undefined): string {
  return role ? (ORGANIZATION_ROLE_LABELS[role] ?? role) : 'Membro'
}

export const OPERATION_ROLE_LABELS: Record<string, string> = {
  owner: 'Responsável pela operação',
  member: 'Membro da operação',
}

export function operationRoleLabel(role: string | null | undefined): string {
  return role ? (OPERATION_ROLE_LABELS[role] ?? role) : 'Membro da operação'
}

export const PILOT_FEEDBACK_CONTEXT_LABELS: Record<string, string> = {
  general: 'Geral',
  onboarding: 'Onboarding',
  organization: 'Organização',
  establishment: 'Unidade',
  catalog: 'Catálogo',
  analytics: 'Analytics',
  moderation: 'Moderação',
}

export function pilotFeedbackContextLabel(context: string): string {
  return PILOT_FEEDBACK_CONTEXT_LABELS[context] ?? context
}

export const PILOT_FEEDBACK_STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  in_review: 'Em análise',
  resolved: 'Resolvido',
  dismissed: 'Descartado',
}

export function pilotFeedbackStatusLabel(status: string): string {
  return PILOT_FEEDBACK_STATUS_LABELS[status] ?? status
}

export { getRevisionStatusMeta } from '~/lib/establishment_editor'
export type { RevisionStatusMeta } from '~/lib/establishment_editor'

export function revisionStatusLabel(status: string): string {
  return getRevisionStatusMeta(status).label
}

export const AVAILABILITY_TYPE_LABELS: Record<string, string> = {
  regular_hours: 'Horários regulares',
  appointment_only: 'Com agendamento',
  always_open: 'Sempre aberto',
}

export function availabilityTypeLabel(type: string): string {
  return AVAILABILITY_TYPE_LABELS[type] ?? type
}

export const MEDIA_MODERATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  quarantined: 'Em quarentena',
  removed: 'Removida',
}

export function mediaModerationStatusLabel(status: string): string {
  return MEDIA_MODERATION_STATUS_LABELS[status] ?? status
}

export const REVISION_EVENT_TYPE_LABELS: Record<string, string> = {
  created: 'Revisão criada',
  submitted: 'Enviada para moderação',
  changes_requested: 'Correções solicitadas',
  resubmitted: 'Reenviada para moderação',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  published: 'Publicada',
  draft_cloned: 'Clonada como rascunho',
}

export function revisionEventTypeLabel(eventType: string): string {
  return REVISION_EVENT_TYPE_LABELS[eventType] ?? eventType
}

export const REVIEW_ISSUE_SEVERITY_LABELS: Record<string, string> = {
  blocking: 'Bloqueio',
  warning: 'Aviso',
}

export function reviewIssueSeverityLabel(severity: string): string {
  return REVIEW_ISSUE_SEVERITY_LABELS[severity] ?? severity
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

function toValidDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = toValidDate(value)
  return date ? dateTimeFormatter.format(date) : ''
}

export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toValidDate(value)
  return date ? dateFormatter.format(date) : ''
}
