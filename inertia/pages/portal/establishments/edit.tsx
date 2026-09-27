import { Head, Link, router, useForm, usePage } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Images,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Save,
  Send,
  Store,
  Tags,
} from 'lucide-react'

import EffectiveAttributesForm, {
  type EffectiveAttribute,
} from '~/components/portal/effective_attributes_form'
import EstablishmentRevisionAction, {
  type EstablishmentRevisionCreationSource,
} from '~/components/portal/establishment_revision_action'
import {
  AddressSection,
  CategoriesSection,
  FeedbackSection,
  HoursSection,
  IdentitySection,
  MediaSection,
  PendingChangesNotice,
  useEstablishmentMediaEditor,
  type AddressFormData,
  type CategoriesFormData,
  type EditorFormState,
  type FeedbackTargets,
  type HoursFormData,
  type IdentityFormData,
} from '~/components/portal/establishment_editor'
import {
  EstablishmentEditorNavigation,
  type EditorNavigationItem,
} from '~/components/portal/establishment_editor_navigation'
import { type EditorDisplayIssue } from '~/components/portal/editor_section'
import { PageHeader } from '~/components/page_header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import {
  asArray,
  asRecord,
  booleanValue,
  EDITOR_SECTION_IDS,
  editorIssueFieldLabel,
  editorSectionForField,
  getRevisionStatusMeta,
  groupEditorIssues,
  localizeCompletenessIssue,
  numberValue,
  relationId,
  revisionPresentationStatus,
  stringValue,
  type EditorIssue,
  type EditorIssueGroupId,
  type EditorSectionId,
  type JsonRecord,
} from '~/lib/establishment_editor'
import { useUnsavedChangesGuard } from '~/hooks/use_unsaved_changes_guard'
import { formatCep, formatPhoneBR } from '~/lib/br_format'
import { firstError } from '~/lib/form_errors'
import { cn } from '~/lib/utils'
import type { OrganizationAllowedActions } from '~/types'
import { scrollBehavior } from '~/lib/motion'

interface CompletenessIssue extends EditorIssue {}
interface ReviewIssue extends EditorIssue {
  id?: number
  resolved_at?: string | null
}

interface Completeness {
  eligible: boolean
  score: number
  blocking_issues: CompletenessIssue[]
  warnings: CompletenessIssue[]
}

export interface RejectionContext {
  version: number
  notes: string | null
}

const READ_ONLY_ACCESS_DESCRIPTION =
  'Você pode consultar estes dados, mas seu acesso não permite editar nem enviar para análise.'

export function establishmentEditorDescription({
  editable,
  canCreateRevision,
  presentationStatus,
}: {
  editable: boolean
  canCreateRevision: boolean
  presentationStatus: string
}): string {
  if (editable) {
    return 'Preencha cada etapa e envie para análise. A moderação confere os dados antes de publicar no app e no site.'
  }

  if (canCreateRevision) {
    return presentationStatus === 'rejected'
      ? 'Esta versão foi recusada. Edite os dados do lugar para enviar uma nova versão; o histórico fica guardado.'
      : 'Estes dados estão publicados. Ao editar, a versão atual continua no ar até a moderação aprovar a nova.'
  }

  return presentationStatus === 'pending_review'
    ? 'Os dados foram enviados e estão em análise pela moderação.'
    : 'Consulte os dados e as pendências em modo somente leitura.'
}

interface EstablishmentEditorProps {
  tenant_id: number
  establishment: JsonRecord
  completeness: Completeness
  cities: JsonRecord[]
  categories: JsonRecord[]
  effective_attributes: EffectiveAttribute[]
  review_issues?: ReviewIssue[]
  rejection_context?: RejectionContext | null
  feedback_targets: FeedbackTargets
  allowed_actions: OrganizationAllowedActions
  revision_creation_source: EstablishmentRevisionCreationSource | null
}

export function RejectionContextNotice({ context }: { context: RejectionContext }) {
  return (
    <section
      aria-labelledby="rejection-context-title"
      className="rounded-card border border-destructive/25 bg-destructive-soft p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="rejection-context-title" className="font-display text-lg font-bold">
              Motivo da recusa
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {context.notes ??
              'Esta versão foi recusada. Fale com a equipe do Experimente+ antes de enviar de novo.'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Use este retorno ao preparar a próxima versão.
          </p>
        </div>
      </div>
    </section>
  )
}

export function RevisionReadOnlyNotice({
  presentationStatus,
  revisionStatus,
}: {
  presentationStatus: string
  revisionStatus: string
}) {
  const statusMeta = getRevisionStatusMeta(presentationStatus)
  const accessIsReadOnly = revisionStatus === 'draft' || revisionStatus === 'changes_requested'
  const published = presentationStatus === 'published'
  const rejected = presentationStatus === 'rejected'
  const title = accessIsReadOnly
    ? 'Apenas leitura para seu acesso'
    : published
      ? 'Publicado no app e no site'
      : rejected
        ? 'Versão recusada'
        : statusMeta.label
  const description = accessIsReadOnly
    ? READ_ONLY_ACCESS_DESCRIPTION
    : published
      ? 'Os campos ficam bloqueados enquanto esta versão está no ar.'
      : statusMeta.description

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-card border px-5 py-4',
        published
          ? 'border-success/25 bg-success-soft'
          : rejected
            ? 'border-destructive/25 bg-destructive-soft'
            : 'border-info/25 bg-info-soft'
      )}
    >
      {published ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
      ) : rejected ? (
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
      ) : (
        <LockKeyhole aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" />
      )}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/**
 * What the moderation asked to change, in one place: the moderator's summary and each
 * request with the field it concerns and a way straight to it (web audit W5/W11).
 */
export function ModerationCorrections({
  issues,
  notes,
  onCorrect,
}: {
  issues: readonly ReviewIssue[]
  notes: string | null
  onCorrect: (issue: ReviewIssue) => void
}) {
  return (
    <section
      aria-labelledby="moderation-corrections-title"
      className="rounded-card border border-warning/30 bg-warning-soft p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-accent" />
        <div className="min-w-0 flex-1">
          <h2 id="moderation-corrections-title" className="font-display text-lg font-bold">
            Correções pedidas pela moderação
          </h2>
          {notes ? (
            <blockquote className="mt-2 border-s-0 text-[0.9375rem] leading-6 text-foreground">
              “{notes}”
            </blockquote>
          ) : (
            <p className="mt-1 text-sm text-foreground">
              Corrija cada item e reenvie para análise.
            </p>
          )}
          <ul className="mt-4 space-y-2.5">
            {issues.map((issue, index) => (
              <li
                key={issue.id ?? `${issue.code}-${issue.field}-${index}`}
                className="flex flex-col gap-3 rounded-2xl border border-warning/25 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-warning-accent">
                    {editorIssueFieldLabel(issue.field)}
                  </p>
                  <p className="mt-1 text-[0.9375rem] leading-6">{issue.message}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  shape="pill"
                  className="shrink-0"
                  onClick={() => onCorrect(issue)}
                >
                  Corrigir
                  <span className="sr-only">: {editorIssueFieldLabel(issue.field)}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function displayIssues(
  completenessIssues: readonly CompletenessIssue[],
  moderationIssues: readonly ReviewIssue[]
): Record<EditorIssueGroupId, EditorDisplayIssue[]> {
  const gateGroups = groupEditorIssues(completenessIssues)
  const moderationGroups = groupEditorIssues(moderationIssues)
  const result = {} as Record<EditorIssueGroupId, EditorDisplayIssue[]>
  const groups: EditorIssueGroupId[] = ['readiness', ...EDITOR_SECTION_IDS]

  for (const group of groups) {
    result[group] = [
      ...gateGroups[group].map((issue) => ({
        key: `gate-${issue.code}-${issue.field}`,
        message: localizeCompletenessIssue(issue),
        field: issue.field,
        source: 'checklist' as const,
        severity: issue.severity,
      })),
      ...moderationGroups[group].map((issue, index) => ({
        key: `review-${issue.id ?? index}-${issue.code}-${issue.field}`,
        message: issue.message,
        field: issue.field,
        source: 'moderation' as const,
        severity: issue.severity,
      })),
    ]
  }

  return result
}

export default function EstablishmentEditorPage({
  tenant_id,
  establishment,
  completeness,
  cities,
  categories,
  effective_attributes,
  review_issues = [],
  rejection_context: rejectionContext = null,
  feedback_targets,
  allowed_actions: allowedActions,
  revision_creation_source: revisionCreationSource,
}: EstablishmentEditorProps) {
  const { errors: pageErrors } = usePage().props as {
    errors?: Record<string, unknown>
  }
  const revision = asRecord(establishment.revision)
  const address = asRecord(revision?.address)
  const establishmentId = Number(establishment.id)
  const organizationId = Number(establishment.organization_id)
  const revisionStatus = stringValue(revision, 'status', 'draft')
  const presentationStatus = revisionPresentationStatus(
    revisionStatus,
    numberValue(revision, 'id'),
    numberValue(establishment, 'published_revision_id')
  )
  const editable = allowedActions.establishments.update
  const submitAllowed = allowedActions.establishments.submit
  const canManageBenefits = allowedActions.benefit_offers.list
  const canSendFeedback = allowedActions.pilot_feedback.create
  const canCreateRevision =
    allowedActions.establishments.create_revision && revisionCreationSource !== null
  const statusMeta = getRevisionStatusMeta(presentationStatus)
  const editorStatusDescription =
    !editable && (revisionStatus === 'draft' || revisionStatus === 'changes_requested')
      ? READ_ONLY_ACCESS_DESCRIPTION
      : statusMeta.description
  const submitLabel =
    revisionStatus === 'changes_requested' ? 'Reenviar para análise' : 'Enviar para análise'
  const effectiveAttributesKey = JSON.stringify(
    effective_attributes.map(({ id, value, option_ids }) => [id, value, option_ids])
  )

  const identityForm = useForm<IdentityFormData>({
    public_name: stringValue(revision, 'public_name'),
    city_id: numberValue(revision, 'city_id'),
    short_description: stringValue(revision, 'short_description'),
    description: stringValue(revision, 'description'),
    public_email: stringValue(revision, 'public_email'),
    public_phone: formatPhoneBR(stringValue(revision, 'public_phone')),
    whatsapp: formatPhoneBR(stringValue(revision, 'whatsapp')),
    website: stringValue(revision, 'website'),
    instagram: stringValue(revision, 'instagram'),
    booking_url: stringValue(revision, 'booking_url'),
    availability_type: stringValue(revision, 'availability_type', 'regular_hours'),
  })

  const addressForm = useForm<AddressFormData>({
    postal_code: formatCep(stringValue(address, 'postal_code')),
    street: stringValue(address, 'street'),
    number: stringValue(address, 'number'),
    without_number: booleanValue(address, 'without_number'),
    complement: stringValue(address, 'complement'),
    district: stringValue(address, 'district'),
    state_code: stringValue(address, 'state_code', 'PR'),
    latitude: numberValue(address, 'latitude'),
    longitude: numberValue(address, 'longitude'),
    coordinate_source: stringValue(address, 'coordinate_source', 'manual'),
  })

  const currentCategories = asArray(revision?.categories)
  const categoriesForm = useForm<CategoriesFormData>({
    categories: currentCategories.map((item, index) => ({
      category_id: relationId(item, 'category_id', 'category') ?? 0,
      is_primary: booleanValue(item, 'is_primary'),
      sort_order: numberValue(item, 'sort_order') ?? index,
    })),
  })

  const storedHours = asArray(revision?.weekly_hours ?? revision?.hours)
  const hoursForm = useForm<HoursFormData>({
    hours:
      storedHours.length > 0
        ? storedHours.map((item, index) => ({
            weekday: numberValue(item, 'weekday') ?? 1,
            opens_at: stringValue(item, 'opens_at', '08:00').slice(0, 5),
            closes_at: stringValue(item, 'closes_at', '18:00').slice(0, 5),
            spans_next_day: booleanValue(item, 'spans_next_day'),
            sort_order: numberValue(item, 'sort_order') ?? index,
          }))
        : [
            {
              weekday: 1,
              opens_at: '08:00',
              closes_at: '18:00',
              spans_next_day: false,
              sort_order: 0,
            },
          ],
  })

  const [attributesFormState, setAttributesFormState] = useState<EditorFormState>({
    dirty: false,
    processing: false,
  })
  const [operationInFlight, setOperationInFlight] = useState(false)
  const operationInFlightRef = useRef(false)
  const unsavedChangesRef = useRef(false)
  const { allowNextVisit } = useUnsavedChangesGuard({
    enabled: () => unsavedChangesRef.current || operationInFlightRef.current,
    message:
      'Há uma operação em andamento ou alterações ainda não salvas. Deseja sair e descartar o trabalho atual?',
  })
  const beginEditorOperation = useCallback(() => {
    if (operationInFlightRef.current) return false

    operationInFlightRef.current = true
    setOperationInFlight(true)
    return true
  }, [])
  const finishEditorOperation = useCallback(() => {
    if (!operationInFlightRef.current) return

    operationInFlightRef.current = false
    setOperationInFlight(false)
  }, [])
  const beginInternalEditorVisit = useCallback(() => {
    if (!beginEditorOperation()) return false
    allowNextVisit()
    return true
  }, [allowNextVisit, beginEditorOperation])
  const media = asArray(revision?.media)
  const mediaEditor = useEstablishmentMediaEditor({
    tenantId: tenant_id,
    establishmentId,
    initialMediaCount: media.length,
    beforeInternalVisit: allowNextVisit,
    tryStartOperation: beginEditorOperation,
    finishOperation: finishEditorOperation,
  })
  const [activeSection, setActiveSection] = useState<EditorSectionId>('identity')
  const [submitting, setSubmitting] = useState(false)

  const handleAttributesStateChange = useCallback((state: EditorFormState) => {
    setAttributesFormState((current) =>
      current.dirty === state.dirty && current.processing === state.processing ? current : state
    )
  }, [])

  const editorFormStates: Array<{
    id: EditorSectionId
    label: string
    dirty: boolean
    processing: boolean
  }> = [
    {
      id: 'identity',
      label: 'Identidade',
      dirty: identityForm.isDirty,
      processing: identityForm.processing,
    },
    {
      id: 'address',
      label: 'Endereço',
      dirty: addressForm.isDirty,
      processing: addressForm.processing,
    },
    {
      id: 'categories',
      label: 'Categorias',
      dirty: categoriesForm.isDirty,
      processing: categoriesForm.processing,
    },
    {
      id: 'attributes',
      label: 'Características',
      dirty: attributesFormState.dirty,
      processing: attributesFormState.processing,
    },
    {
      id: 'hours',
      label: 'Horários',
      dirty: hoursForm.isDirty,
      processing: hoursForm.processing,
    },
    {
      id: 'media',
      label: 'Mídia',
      dirty: mediaEditor.uploadDraftDirty,
      processing: mediaEditor.busy,
    },
  ]
  const dirtySections = editorFormStates.filter((section) => section.dirty)
  const firstDirtySection = dirtySections[0]
  const hasUnsavedChanges = dirtySections.length > 0
  const editorBusy = operationInFlight || editorFormStates.some((section) => section.processing)
  unsavedChangesRef.current = hasUnsavedChanges

  const issuesBySection = useMemo(
    () => displayIssues(completeness.blocking_issues, review_issues),
    [completeness.blocking_issues, review_issues]
  )

  const navigationItems = useMemo<EditorNavigationItem[]>(() => {
    const items: EditorNavigationItem[] = [
      {
        id: 'identity',
        label: 'Identidade',
        icon: Store,
        issueCount: issuesBySection.identity.length,
      },
      {
        id: 'address',
        label: 'Endereço',
        icon: MapPin,
        issueCount: issuesBySection.address.length,
      },
      {
        id: 'categories',
        label: 'Categorias',
        icon: Tags,
        issueCount: issuesBySection.categories.length,
      },
      {
        id: 'attributes',
        label: 'Características',
        icon: CheckCircle2,
        issueCount: issuesBySection.attributes.length,
      },
      {
        id: 'hours',
        label: 'Horários',
        icon: Clock3,
        issueCount: issuesBySection.hours.length,
      },
      {
        id: 'media',
        label: 'Mídia',
        icon: Images,
        issueCount: issuesBySection.media.length,
      },
      {
        id: 'feedback',
        label: 'Feedback',
        icon: MessageSquareText,
        issueCount: 0,
        optional: true,
      },
    ]

    return items.filter((item) => item.id !== 'feedback' || canSendFeedback)
  }, [canSendFeedback, issuesBySection])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const elements = EDITOR_SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (element): element is HTMLElement => element !== null
    )
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0]
        if (visible?.target.id) setActiveSection(visible.target.id as EditorSectionId)
      },
      { rootMargin: '-22% 0px -62% 0px', threshold: 0 }
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  function navigateTo(section: EditorSectionId) {
    setActiveSection(section)
    document.getElementById(section)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
  }

  /**
   * Takes the partner to what the moderation asked to fix: the step, then the field
   * itself when it has one, so "Corrigir" lands the cursor where the edit happens.
   */
  function focusIssueField(field: string) {
    const section = editorSectionForField(field)
    const target = section === 'readiness' ? 'identity' : section
    navigateTo(target)
    const control = document.querySelector<HTMLElement>(`#${target} [name="${CSS.escape(field)}"]`)
    const heading = document.getElementById(`${target}-title`)
    const focusTarget = control ?? heading
    if (!focusTarget) return
    if (focusTarget === heading) heading.setAttribute('tabindex', '-1')
    focusTarget.focus({ preventScroll: true })
  }

  function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!beginInternalEditorVisit()) return

    identityForm.put(`/portal/establishments/${establishmentId}/identity`, {
      preserveScroll: true,
      onSuccess: () => identityForm.setDefaults(),
      onFinish: finishEditorOperation,
    })
  }

  function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!beginInternalEditorVisit()) return

    addressForm.put(`/portal/establishments/${establishmentId}/address`, {
      preserveScroll: true,
      onSuccess: () => addressForm.setDefaults(),
      onFinish: finishEditorOperation,
    })
  }

  function saveCategories(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (attributesFormState.dirty) {
      navigateTo('attributes')
      return
    }
    if (!beginInternalEditorVisit()) return

    categoriesForm.put(`/portal/establishments/${establishmentId}/categories`, {
      preserveScroll: true,
      onSuccess: () => categoriesForm.setDefaults(),
      onFinish: finishEditorOperation,
    })
  }

  function saveHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!beginInternalEditorVisit()) return

    hoursForm.transform((data) => ({
      hours: data.hours.map((hour, index) => ({ ...hour, sort_order: index })),
    }))
    hoursForm.put(`/portal/establishments/${establishmentId}/hours`, {
      preserveScroll: true,
      onSuccess: () => hoursForm.setDefaults(),
      onFinish: finishEditorOperation,
    })
  }

  function submitForReview() {
    if (!submitAllowed || editorBusy || submitting) return
    if (firstDirtySection) {
      navigateTo(firstDirtySection.id)
      return
    }

    if (!beginInternalEditorVisit()) return
    setSubmitting(true)
    router.post(
      `/portal/establishments/${establishmentId}/submit`,
      {},
      {
        preserveScroll: true,
        onFinish: () => {
          setSubmitting(false)
          finishEditorOperation()
        },
      }
    )
  }

  function createRevision(source: EstablishmentRevisionCreationSource) {
    if (!canCreateRevision || editorBusy) return
    if (!beginInternalEditorVisit()) return

    router.post(
      `/portal/establishments/${establishmentId}/revisions`,
      { source },
      {
        preserveScroll: true,
        onFinish: finishEditorOperation,
      }
    )
  }

  const availabilityLabel =
    identityForm.data.availability_type === 'always_open'
      ? 'Sempre aberto'
      : identityForm.data.availability_type === 'appointment_only'
        ? 'Com agendamento'
        : 'Horários regulares'
  const submissionError = firstError(pageErrors?.submission)
  // Checklist gates that no step owns stay in their own banner; moderation requests go
  // to the corrections card, never under a "blocked" label (web audit W5).
  const readinessIssues = issuesBySection.readiness.filter((issue) => issue.source === 'checklist')
  const reviewNotes = stringValue(revision, 'review_notes').trim()
  const correctionCount = review_issues.length
  const submitDisabledReason = hasUnsavedChanges
    ? 'Salve todas as etapas antes de enviar para análise.'
    : editorBusy
      ? 'Aguarde a operação atual terminar.'
      : !completeness.eligible
        ? 'Resolva o que falta preencher antes de enviar para análise.'
        : undefined
  const submitActionLabel = submitting
    ? 'Enviando…'
    : editorBusy
      ? 'Aguarde…'
      : hasUnsavedChanges
        ? 'Salve antes de enviar'
        : submitLabel
  const pageTitle = stringValue(revision, 'public_name', 'Dados do lugar')
  const pageDescription = establishmentEditorDescription({
    editable,
    canCreateRevision,
    presentationStatus,
  })

  return (
    <MainLayout>
      <Head title={`${hasUnsavedChanges ? '• ' : ''}${pageTitle}`} />

      <div className="space-y-6">
        <PageHeader
          eyebrow="Dados do lugar"
          icon={Store}
          title={stringValue(revision, 'public_name', 'Lugar sem nome')}
          description={pageDescription}
          meta={
            <>
              <span
                className={cn(
                  'inline-flex h-7 items-center rounded-full border px-3 text-[0.8125rem] font-bold',
                  statusMeta.className
                )}
              >
                {statusMeta.label}
              </span>
              <Badge
                variant={completeness.eligible ? 'success' : 'neutral'}
                appearance="light"
                shape="pill"
                size="lg"
              >
                {completeness.score}% preenchido
              </Badge>
            </>
          }
          actions={
            <>
              {canManageBenefits ? (
                <Button asChild variant="outline" size="lg" shape="pill">
                  <Link href={`/portal/establishments/${establishment.id}/benefits`}>
                    <Store />
                    Benefícios
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="ghost" size="lg" shape="pill">
                <Link
                  href={`/portal/organizations/${organizationId}`}
                  aria-disabled={editorBusy || submitting || undefined}
                  tabIndex={editorBusy || submitting ? -1 : undefined}
                  onClick={(event) => {
                    if (editorBusy || submitting) event.preventDefault()
                  }}
                >
                  <ArrowLeft />
                  Voltar
                </Link>
              </Button>
              <EstablishmentRevisionAction
                allowed={canCreateRevision}
                source={revisionCreationSource}
                processing={editorBusy}
                onCreate={createRevision}
              />
              {submitAllowed ? (
                <Button
                  type="button"
                  size="xl"
                  shape="pill"
                  disabled={!completeness.eligible || submitting || editorBusy || hasUnsavedChanges}
                  title={submitDisabledReason}
                  onClick={submitForReview}
                >
                  {submitting || editorBusy ? (
                    <LoaderCircle className="animate-spin" />
                  ) : hasUnsavedChanges ? (
                    <Save />
                  ) : (
                    <Send />
                  )}
                  {submitActionLabel}
                </Button>
              ) : null}
            </>
          }
        />

        {submissionError ? (
          <div className="flex items-start gap-3 rounded-card border border-destructive/25 bg-destructive-soft px-5 py-4 text-sm text-destructive-accent">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Os dados ainda não puderam ser enviados</p>
              <p className="mt-1 leading-5">{submissionError}</p>
            </div>
          </div>
        ) : null}

        {rejectionContext ? <RejectionContextNotice context={rejectionContext} /> : null}

        {correctionCount > 0 ? (
          <ModerationCorrections
            issues={review_issues}
            notes={reviewNotes || null}
            onCorrect={(issue) => focusIssueField(issue.field)}
          />
        ) : null}

        {readinessIssues.length > 0 ? (
          <div className="rounded-card border border-warning/25 bg-warning-soft px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-accent" />
              <div>
                <p className="font-semibold">Antes de enviar para análise</p>
                <div className="mt-2 space-y-1 text-sm text-foreground">
                  {readinessIssues.map((issue) => (
                    <p key={issue.key}>{issue.message}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!editable ? (
          <RevisionReadOnlyNotice
            presentationStatus={presentationStatus}
            revisionStatus={revisionStatus}
          />
        ) : null}

        <PendingChangesNotice
          dirtySectionCount={dirtySections.length}
          firstSectionLabel={firstDirtySection?.label}
          busy={editorBusy}
          onReview={() => {
            if (firstDirtySection) navigateTo(firstDirtySection.id)
          }}
        />

        <EstablishmentEditorNavigation
          variant="mobile"
          items={navigationItems}
          activeSection={activeSection}
          onNavigate={navigateTo}
          score={completeness.score}
          eligible={completeness.eligible}
          submitAllowed={submitAllowed}
          submitting={submitting}
          busy={editorBusy}
          unsavedSectionCount={dirtySections.length}
          onSubmit={submitForReview}
          submitLabel={submitLabel}
          statusLabel={editorStatusDescription}
          lockedLabel={statusMeta.label}
          correctionCount={correctionCount}
        />

        {/* Two columns only from 1280 px: at 1024 the app sidebar left the form about 400 px
            beside the step list, and section titles wrapped one word per line. */}
        <div className="grid min-w-0 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <EstablishmentEditorNavigation
            variant="desktop"
            items={navigationItems}
            activeSection={activeSection}
            onNavigate={navigateTo}
            score={completeness.score}
            eligible={completeness.eligible}
            submitAllowed={submitAllowed}
            submitting={submitting}
            busy={editorBusy}
            unsavedSectionCount={dirtySections.length}
            onSubmit={submitForReview}
            submitLabel={submitLabel}
            statusLabel={editorStatusDescription}
            lockedLabel={statusMeta.label}
            correctionCount={correctionCount}
          />

          <div className="min-w-0 space-y-6">
            <IdentitySection
              form={identityForm}
              cities={cities}
              editable={editable}
              busy={editorBusy}
              issues={issuesBySection.identity}
              availabilityLabel={availabilityLabel}
              onSubmit={saveIdentity}
            />

            <AddressSection
              form={addressForm}
              editable={editable}
              busy={editorBusy}
              issues={issuesBySection.address}
              onSubmit={saveAddress}
            />

            <CategoriesSection
              form={categoriesForm}
              categories={categories}
              editable={editable}
              busy={editorBusy}
              blockedByUnsavedAttributes={attributesFormState.dirty}
              issues={issuesBySection.categories}
              onSubmit={saveCategories}
              onReviewAttributes={() => navigateTo('attributes')}
            />

            <EffectiveAttributesForm
              key={effectiveAttributesKey}
              establishmentId={establishmentId}
              attributes={effective_attributes}
              editable={editable}
              busy={editorBusy}
              categoriesDirty={categoriesForm.isDirty}
              issues={issuesBySection.attributes}
              onStateChange={handleAttributesStateChange}
              onBeforeSubmit={beginInternalEditorVisit}
              onSubmitFinish={finishEditorOperation}
              onReviewCategories={() => navigateTo('categories')}
            />

            <HoursSection
              form={hoursForm}
              editable={editable}
              busy={editorBusy}
              issues={issuesBySection.hours}
              availabilityType={identityForm.data.availability_type}
              availabilityLabel={availabilityLabel}
              onSubmit={saveHours}
              onReviewIdentity={() => navigateTo('identity')}
            />

            <MediaSection
              media={media}
              editable={editable}
              blocked={editorBusy && !mediaEditor.busy}
              issues={issuesBySection.media}
              editor={mediaEditor}
            />

            {canSendFeedback ? (
              <FeedbackSection
                targets={feedback_targets}
                organizationId={organizationId}
                establishmentId={establishmentId}
              />
            ) : null}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
