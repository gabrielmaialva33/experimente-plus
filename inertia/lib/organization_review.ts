/**
 * Presentation of the organization review workflow, shared by the back-office
 * "Organizações" queue and the partner Portal. The rules stay in the
 * organization workflow service; this only names and colours its states.
 */

export type OrganizationStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'active'
  | 'rejected'
  | 'suspended'
  | 'archived'

/** Direction A: green live, blue in review, amber waiting on the business, red closed. */
export function organizationStatusVariant(status: string) {
  if (status === 'active') return 'success' as const
  if (status === 'pending_review') return 'info' as const
  if (status === 'changes_requested') return 'warning' as const
  if (status === 'rejected' || status === 'suspended') return 'destructive' as const
  return 'neutral' as const
}

/** The queue's filters name each state as a group of organizations. */
const FILTER_LABELS: Record<OrganizationStatus, string> = {
  draft: 'Rascunhos',
  pending_review: 'Em análise',
  changes_requested: 'Correções solicitadas',
  active: 'Ativas',
  rejected: 'Rejeitadas',
  suspended: 'Suspensas',
  archived: 'Arquivadas',
}

export function organizationStatusFilterLabel(status: OrganizationStatus): string {
  return FILTER_LABELS[status]
}

const HISTORY_LABELS: Record<string, string> = {
  create: 'Criou a organização',
  update: 'Editou os dados da organização',
  submit: 'Enviou para análise',
  approve: 'Aprovou',
  request_changes: 'Pediu correções',
  reject: 'Rejeitou',
  suspend: 'Suspendeu',
  restore: 'Reativou',
  archive: 'Arquivou',
}

export function organizationHistoryLabel(action: string): string {
  return HISTORY_LABELS[action] ?? 'Alterou a organização'
}
