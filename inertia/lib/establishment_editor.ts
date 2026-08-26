export const EDITOR_SECTION_IDS = [
  'identity',
  'address',
  'categories',
  'attributes',
  'hours',
  'media',
  'feedback',
] as const

export type EditorSectionId = (typeof EDITOR_SECTION_IDS)[number]
export type EditorIssueGroupId = 'readiness' | EditorSectionId
export type JsonRecord = Record<string, unknown>

export function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

export function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => asRecord(item) !== null)
    : []
}

export function stringValue(record: JsonRecord | null, key: string, fallback = ''): string {
  const value = record?.[key]
  return typeof value === 'string' ? value : fallback
}

export function numberValue(record: JsonRecord | null, key: string): number | null {
  const value = record?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

export function booleanValue(record: JsonRecord | null, key: string): boolean {
  return record?.[key] === true
}

export function relationId(
  record: JsonRecord,
  directKey: string,
  relationKey: string
): number | null {
  const direct = numberValue(record, directKey)
  if (direct !== null) return direct
  return numberValue(asRecord(record[relationKey]), 'id')
}

export interface EditorIssue {
  code: string
  field: string
  message: string
  severity: string
  metadata?: Record<string, unknown>
}

export interface RevisionStatusMeta {
  label: string
  description: string
  className: string
}

const STATUS_META: Record<string, RevisionStatusMeta> = {
  draft: {
    label: 'Rascunho',
    description: 'A ficha está aberta para edição.',
    className: 'border-border bg-muted text-muted-foreground',
  },
  changes_requested: {
    label: 'Correções solicitadas',
    description: 'A moderação devolveu a ficha para ajustes.',
    className:
      'border-[var(--color-warning-alpha,var(--color-yellow-200))] bg-[var(--color-warning-soft,var(--color-yellow-50))] text-[var(--color-warning-foreground,var(--color-yellow-700))] dark:border-[var(--color-warning-alpha,var(--color-yellow-900))] dark:bg-[var(--color-warning-soft,var(--color-yellow-950))]',
  },
  pending_review: {
    label: 'Em moderação',
    description: 'A ficha está bloqueada enquanto a equipe faz a análise.',
    className:
      'border-[var(--color-info-alpha,var(--color-violet-200))] bg-[var(--color-info-soft,var(--color-violet-50))] text-[var(--color-info-foreground,var(--color-violet-700))] dark:border-[var(--color-info-alpha,var(--color-violet-900))] dark:bg-[var(--color-info-soft,var(--color-violet-950))]',
  },
  approved: {
    label: 'Aprovada',
    description: 'A revisão foi aprovada e aguarda a publicação.',
    className:
      'border-[var(--color-success-alpha,var(--color-green-200))] bg-[var(--color-success-soft,var(--color-green-50))] text-[var(--color-success-foreground,var(--color-green-700))] dark:border-[var(--color-success-alpha,var(--color-green-900))] dark:bg-[var(--color-success-soft,var(--color-green-950))]',
  },
  rejected: {
    label: 'Rejeitada',
    description: 'A revisão foi encerrada sem publicação.',
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
  published: {
    label: 'Publicada',
    description: 'Esta revisão está disponível no catálogo público.',
    className:
      'border-[var(--color-success-alpha,var(--color-green-200))] bg-[var(--color-success-soft,var(--color-green-50))] text-[var(--color-success-foreground,var(--color-green-700))] dark:border-[var(--color-success-alpha,var(--color-green-900))] dark:bg-[var(--color-success-soft,var(--color-green-950))]',
  },
}

const ISSUE_MESSAGES: Record<string, string> = {
  organization_not_active: 'A organização precisa estar ativa antes do envio para moderação.',
  public_identity_missing: 'Informe o nome público e ao menos uma descrição da unidade.',
  city_inactive: 'Selecione uma cidade ativa para a unidade.',
  address_missing: 'Informe logradouro, bairro e número — ou marque que o endereço não tem número.',
  coordinates_missing: 'Informe latitude e longitude válidas para localizar a unidade no mapa.',
  category_inactive: 'A categoria principal está inativa. Escolha outra categoria disponível.',
  primary_category_missing:
    'Selecione uma categoria principal para definir a classificação da unidade.',
  availability_missing:
    'Escolha como a unidade atende: por horário, sempre aberta ou por agendamento.',
  weekly_hours_missing: 'Cadastre ao menos um intervalo semanal para o atendimento regular.',
  appointment_contact_missing:
    'Informe telefone, WhatsApp ou link de agendamento para o atendimento com hora marcada.',
  always_open_not_allowed: 'A categoria principal não permite a opção “Sempre aberto”.',
  contact_channel_missing: 'Informe ao menos um canal público de contato.',
  media_missing: 'Adicione ao menos uma imagem para representar a unidade.',
  cover_image_missing: 'Escolha exatamente uma imagem elegível como capa da unidade.',
  media_quarantined: 'Remova as imagens em quarentena antes de enviar a ficha.',
  establishment_not_active: 'A unidade precisa estar ativa antes do envio.',
  establishment_permanently_closed: 'Uma unidade permanentemente fechada não pode ser enviada.',
}

export function getRevisionStatusMeta(status: string): RevisionStatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status.replaceAll('_', ' '),
      description: 'Status atual da revisão.',
      className: 'border-border bg-muted text-muted-foreground',
    }
  )
}

export function localizeCompletenessIssue(issue: EditorIssue): string {
  const knownMessage = ISSUE_MESSAGES[issue.code]
  if (knownMessage) return knownMessage

  if (issue.code === 'required_attribute_missing') {
    const requiredMatch = issue.message.match(/^(.+) is required$/i)
    if (requiredMatch?.[1]) return `${requiredMatch[1]} é obrigatório.`
    return 'Preencha esta característica obrigatória da categoria.'
  }

  return issue.message
}

export function editorSectionForField(field: string): EditorIssueGroupId {
  if (field.startsWith('address')) return 'address'
  if (field === 'categories' || field.startsWith('categories.')) return 'categories'
  if (field === 'attributes' || field.startsWith('attributes.')) return 'attributes'
  if (field === 'hours' || field.startsWith('hours.')) return 'hours'
  if (field === 'media' || field.startsWith('media.')) return 'media'

  if (
    [
      'public_name',
      'city_id',
      'short_description',
      'description',
      'availability_type',
      'booking_url',
      'contacts',
      'public_email',
      'public_phone',
      'whatsapp',
      'website',
      'instagram',
    ].includes(field)
  ) {
    return 'identity'
  }

  return 'readiness'
}

/**
 * Presentation-only catalog of the revision fields the partner editor knows,
 * grouped the same way `editorSectionForField` groups moderation issues. The
 * backoffice uses it to offer selects instead of free-text field names; the
 * backend keeps validating code/field/severity on submission.
 */
export interface ModerationIssueFieldGroup {
  section: EditorIssueGroupId
  label: string
  options: Array<{ value: string; label: string }>
}

export const MODERATION_ISSUE_FIELD_GROUPS: ModerationIssueFieldGroup[] = [
  {
    section: 'readiness',
    label: 'Ficha',
    options: [{ value: 'revision', label: 'Ficha como um todo' }],
  },
  {
    section: 'identity',
    label: 'Identidade',
    options: [
      { value: 'public_name', label: 'Nome público' },
      { value: 'short_description', label: 'Descrição curta' },
      { value: 'description', label: 'Descrição completa' },
      { value: 'city_id', label: 'Cidade' },
      { value: 'availability_type', label: 'Forma de atendimento' },
      { value: 'booking_url', label: 'Link de agendamento' },
      { value: 'contacts', label: 'Canais de contato' },
      { value: 'public_email', label: 'E-mail público' },
      { value: 'public_phone', label: 'Telefone público' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'website', label: 'Site' },
      { value: 'instagram', label: 'Instagram' },
    ],
  },
  {
    section: 'address',
    label: 'Endereço',
    options: [
      { value: 'address', label: 'Endereço completo' },
      { value: 'address.coordinates', label: 'Coordenadas no mapa' },
    ],
  },
  {
    section: 'categories',
    label: 'Categorias',
    options: [{ value: 'categories', label: 'Categorias da unidade' }],
  },
  {
    section: 'attributes',
    label: 'Características',
    options: [{ value: 'attributes', label: 'Características da categoria' }],
  },
  {
    section: 'hours',
    label: 'Horários',
    options: [{ value: 'hours', label: 'Horários de atendimento' }],
  },
  {
    section: 'media',
    label: 'Mídia',
    options: [
      { value: 'media', label: 'Imagens da unidade' },
      { value: 'media.cover', label: 'Imagem de capa' },
    ],
  },
]

export function editorSectionForIssue(issue: Pick<EditorIssue, 'field'>): EditorIssueGroupId {
  return editorSectionForField(issue.field)
}

export function groupEditorIssues<TIssue extends Pick<EditorIssue, 'field'>>(
  issues: readonly TIssue[]
): Record<EditorIssueGroupId, TIssue[]> {
  const grouped: Record<EditorIssueGroupId, TIssue[]> = {
    readiness: [],
    identity: [],
    address: [],
    categories: [],
    attributes: [],
    hours: [],
    media: [],
    feedback: [],
  }

  for (const issue of issues) {
    grouped[editorSectionForIssue(issue)].push(issue)
  }

  return grouped
}

export function hasAttributeInputValue(
  value: string | number | boolean | null,
  optionIds: readonly number[]
): boolean {
  if (optionIds.length > 0) return true
  if (typeof value === 'boolean' || typeof value === 'number') return true
  return typeof value === 'string' && value.trim().length > 0
}
