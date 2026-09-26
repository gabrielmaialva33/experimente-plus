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

// Text on a soft status background uses that status's accent token. The
// `-foreground` tokens are made for the solid status colour; on the soft tint
// they measured 1.13:1 (web audit W6).
const STATUS_META: Record<string, RevisionStatusMeta> = {
  draft: {
    label: 'Rascunho',
    description: 'Os dados do lugar estão abertos para edição.',
    className: 'border-border bg-muted text-muted-foreground',
  },
  changes_requested: {
    label: 'Correções pedidas',
    description: 'A moderação pediu correções antes de publicar.',
    className: 'border-warning/30 bg-warning-soft text-warning-accent',
  },
  pending_review: {
    label: 'Em moderação',
    description: 'Os dados estão em análise pela moderação; a edição volta quando ela responder.',
    className: 'border-info/30 bg-info-soft text-info-accent',
  },
  approved: {
    label: 'Aprovada',
    description: 'Os dados foram aprovados e serão publicados em seguida.',
    className: 'border-success/30 bg-success-soft text-success-accent',
  },
  rejected: {
    label: 'Recusada',
    description: 'Esta versão foi recusada e não será publicada.',
    className: 'border-destructive/25 bg-destructive-soft text-destructive-accent',
  },
  published: {
    label: 'Publicada',
    description: 'Estes dados estão publicados no app e no site.',
    className: 'border-success/30 bg-success-soft text-success-accent',
  },
}

const ISSUE_MESSAGES: Record<string, string> = {
  organization_not_active: 'A organização precisa estar ativa antes do envio para moderação.',
  public_identity_missing: 'Informe o nome público e ao menos uma descrição do lugar.',
  city_inactive: 'Selecione uma cidade ativa para o lugar.',
  address_missing: 'Informe logradouro, bairro e número — ou marque que o endereço não tem número.',
  coordinates_missing: 'Informe latitude e longitude válidas para localizar o lugar no mapa.',
  category_inactive: 'A categoria principal está inativa. Escolha outra categoria disponível.',
  primary_category_missing: 'Selecione uma categoria principal para o lugar.',
  availability_missing:
    'Escolha como o lugar atende: por horário, sempre aberto ou com agendamento.',
  weekly_hours_missing: 'Cadastre ao menos um intervalo semanal para o atendimento regular.',
  appointment_contact_missing:
    'Informe telefone, WhatsApp ou link de agendamento para o atendimento com hora marcada.',
  always_open_not_allowed: 'A categoria principal não permite a opção “Sempre aberto”.',
  contact_channel_missing: 'Informe ao menos um canal público de contato.',
  media_missing: 'Adicione ao menos uma imagem do lugar.',
  cover_image_missing: 'Escolha uma imagem como capa do lugar.',
  media_quarantined: 'Remova as imagens bloqueadas antes de enviar os dados.',
  establishment_not_active: 'O lugar precisa estar ativo antes do envio.',
  establishment_permanently_closed: 'Um lugar fechado definitivamente não pode ser enviado.',
  slug_already_published:
    'O endereço público já é usado por outro lugar desta cidade. Altere o nome público para gerar outro endereço.',
}

export function getRevisionStatusMeta(status: string): RevisionStatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status.replaceAll('_', ' '),
      description: 'Situação atual dos dados do lugar.',
      className: 'border-border bg-muted text-muted-foreground',
    }
  )
}

export function revisionPresentationStatus(
  technicalStatus: string,
  revisionId: number | null,
  publishedRevisionId: number | null
): string {
  return revisionId !== null && revisionId === publishedRevisionId ? 'published' : technicalStatus
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
      'slug',
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
    label: 'Dados do lugar',
    options: [{ value: 'revision', label: 'Dados do lugar como um todo' }],
  },
  {
    section: 'identity',
    label: 'Identidade',
    options: [
      { value: 'public_name', label: 'Nome público' },
      { value: 'slug', label: 'URL pública' },
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
    options: [{ value: 'categories', label: 'Categorias do lugar' }],
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
      { value: 'media', label: 'Imagens do lugar' },
      { value: 'media.cover', label: 'Imagem de capa' },
    ],
  },
]

const MODERATION_ISSUE_FIELD_LABELS = new Map(
  MODERATION_ISSUE_FIELD_GROUPS.flatMap((group) =>
    group.options.map((option) => [option.value, option.label] as const)
  )
)

export function editorIssueFieldLabel(field: string): string {
  const normalizedField = field.trim()
  const exactLabel = MODERATION_ISSUE_FIELD_LABELS.get(normalizedField)
  if (exactLabel) return exactLabel

  const section = editorSectionForField(normalizedField)
  return (
    MODERATION_ISSUE_FIELD_GROUPS.find((group) => group.section === section)?.label ??
    'Dados do lugar'
  )
}

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
