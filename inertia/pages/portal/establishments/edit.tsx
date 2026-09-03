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
  getRevisionStatusMeta,
  groupEditorIssues,
  localizeCompletenessIssue,
  numberValue,
  relationId,
  stringValue,
  type EditorIssue,
  type EditorIssueGroupId,
  type EditorSectionId,
  type JsonRecord,
} from '~/lib/establishment_editor'
import { useUnsavedChangesGuard } from '~/hooks/use_unsaved_changes_guard'
import { useAuth } from '~/hooks/use_auth'
import { firstError } from '~/lib/form_errors'
import { cn } from '~/lib/utils'

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

interface EstablishmentEditorProps {
  tenant_id: number
  establishment: JsonRecord
  completeness: Completeness
  cities: JsonRecord[]
  categories: JsonRecord[]
  effective_attributes: EffectiveAttribute[]
  review_issues?: ReviewIssue[]
  feedback_targets: FeedbackTargets
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
  feedback_targets,
}: EstablishmentEditorProps) {
  const { errors: pageErrors } = usePage().props as {
    errors?: Record<string, unknown>
  }
  const { can } = useAuth()
  const revision = asRecord(establishment.revision)
  const address = asRecord(revision?.address)
  const establishmentId = Number(establishment.id)
  const organizationId = Number(establishment.organization_id)
  const revisionStatus = stringValue(revision, 'status', 'draft')
  const revisionVersion = numberValue(revision, 'version') ?? 1
  const contentStateEditable = ['draft', 'changes_requested'].includes(revisionStatus)
  const editable = contentStateEditable && can('establishments.update')
  const submitAllowed = contentStateEditable && can('establishments.submit')
  const canManageBenefits = can('benefit_offers.list')
  const canSendFeedback = can('pilot_feedback.create')
  const statusMeta = getRevisionStatusMeta(revisionStatus)
  const submitLabel =
    revisionStatus === 'changes_requested' ? 'Reenviar para moderação' : 'Enviar para moderação'
  const effectiveAttributesKey = JSON.stringify(
    effective_attributes.map(({ id, value, option_ids }) => [id, value, option_ids])
  )

  const identityForm = useForm<IdentityFormData>({
    public_name: stringValue(revision, 'public_name'),
    city_id: numberValue(revision, 'city_id'),
    short_description: stringValue(revision, 'short_description'),
    description: stringValue(revision, 'description'),
    public_email: stringValue(revision, 'public_email'),
    public_phone: stringValue(revision, 'public_phone'),
    whatsapp: stringValue(revision, 'whatsapp'),
    website: stringValue(revision, 'website'),
    instagram: stringValue(revision, 'instagram'),
    booking_url: stringValue(revision, 'booking_url'),
    availability_type: stringValue(revision, 'availability_type', 'regular_hours'),
  })

  const addressForm = useForm<AddressFormData>({
    postal_code: stringValue(address, 'postal_code'),
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
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    document
      .getElementById(section)
      ?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
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

  const availabilityLabel =
    identityForm.data.availability_type === 'always_open'
      ? 'Sempre aberto'
      : identityForm.data.availability_type === 'appointment_only'
        ? 'Com agendamento'
        : 'Horários regulares'
  const submissionError = firstError(pageErrors?.submission)
  const readinessIssues = issuesBySection.readiness
  const firstReviewSection =
    EDITOR_SECTION_IDS.find((section) =>
      issuesBySection[section].some((issue) => issue.source === 'moderation')
    ) ?? 'identity'
  const submitDisabledReason = !submitAllowed
    ? contentStateEditable
      ? 'Sua conta não possui permissão para enviar esta ficha.'
      : statusMeta.description
    : hasUnsavedChanges
      ? 'Salve todas as etapas antes de enviar para moderação.'
      : editorBusy
        ? 'Aguarde a operação atual terminar.'
        : !completeness.eligible
          ? 'Resolva as pendências do checklist antes de enviar para moderação.'
          : undefined
  const submitActionLabel = submitting
    ? 'Enviando…'
    : editorBusy
      ? 'Aguarde…'
      : hasUnsavedChanges
        ? 'Salve antes de enviar'
        : submitAllowed
          ? submitLabel
          : statusMeta.label
  const pageTitle = stringValue(revision, 'public_name', 'Editar unidade')

  return (
    <MainLayout>
      <Head title={`${hasUnsavedChanges ? '• ' : ''}${pageTitle}`} />

      <div className="space-y-6">
        <PageHeader
          eyebrow="Editor da unidade"
          icon={Store}
          title={stringValue(revision, 'public_name', 'Unidade sem nome')}
          description="Complete cada etapa da ficha pública. O servidor recalcula a prontidão e aplica as mesmas regras no envio e na publicação."
          meta={
            <>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                  statusMeta.className
                )}
              >
                {statusMeta.label}
              </span>
              <Badge variant="outline">Revisão {revisionVersion}</Badge>
              <Badge variant={completeness.eligible ? 'success' : 'secondary'} appearance="light">
                {completeness.score}% concluído
              </Badge>
            </>
          }
          actions={
            <>
              {canManageBenefits ? (
                <Button asChild variant="outline" size="lg">
                  <Link href={`/portal/establishments/${establishment.id}/benefits`}>
                    <Store />
                    Benefícios
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="lg">
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
              <Button
                type="button"
                size="lg"
                disabled={
                  !submitAllowed ||
                  !completeness.eligible ||
                  submitting ||
                  editorBusy ||
                  hasUnsavedChanges
                }
                title={submitDisabledReason}
                onClick={submitForReview}
              >
                {submitting || editorBusy ? (
                  <LoaderCircle className="animate-spin" />
                ) : hasUnsavedChanges ? (
                  <Save />
                ) : submitAllowed ? (
                  <Send />
                ) : (
                  <LockKeyhole />
                )}
                {submitActionLabel}
              </Button>
            </>
          }
        />

        {submissionError ? (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">A ficha ainda não pôde ser enviada</p>
              <p className="mt-1 leading-5">{submissionError}</p>
            </div>
          </div>
        ) : null}

        {review_issues.length > 0 ? (
          <div className="flex flex-col gap-4 rounded-xl border border-warning/25 bg-warning/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
              <div>
                <p className="font-semibold">A moderação pediu ajustes nesta revisão</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  As observações aparecem também na etapa correspondente para facilitar a correção.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => navigateTo(firstReviewSection)}>
              Ver primeira correção
            </Button>
          </div>
        ) : null}

        {readinessIssues.length > 0 ? (
          <div className="rounded-xl border border-warning/25 bg-warning/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
              <div>
                <p className="font-semibold">Há uma condição externa bloqueando o envio</p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {readinessIssues.map((issue) => (
                    <p key={issue.key}>{issue.message}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!editable ? (
          <div className="flex items-start gap-3 rounded-xl border border-info/20 bg-info/5 px-4 py-3">
            <LockKeyhole className="mt-0.5 size-5 shrink-0 text-info" />
            <div>
              <p className="font-semibold">Edição temporariamente bloqueada</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {statusMeta.description}
              </p>
            </div>
          </div>
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
          editable={editable}
          submitAllowed={submitAllowed}
          submitting={submitting}
          busy={editorBusy}
          unsavedSectionCount={dirtySections.length}
          onSubmit={submitForReview}
          submitLabel={submitLabel}
          statusLabel={statusMeta.description}
          lockedLabel={statusMeta.label}
        />

        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          <EstablishmentEditorNavigation
            variant="desktop"
            items={navigationItems}
            activeSection={activeSection}
            onNavigate={navigateTo}
            score={completeness.score}
            eligible={completeness.eligible}
            editable={editable}
            submitAllowed={submitAllowed}
            submitting={submitting}
            busy={editorBusy}
            unsavedSectionCount={dirtySections.length}
            onSubmit={submitForReview}
            submitLabel={submitLabel}
            statusLabel={statusMeta.description}
            lockedLabel={statusMeta.label}
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
