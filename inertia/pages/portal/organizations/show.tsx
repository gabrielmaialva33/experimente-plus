import { Head, Link, router, useForm } from '@inertiajs/react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  ChevronDown,
  Loader2,
  MapPin,
  Plus,
  Save,
  Send,
} from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import PilotFeedbackForm from '~/components/portal/pilot_feedback_form'
import { EditorField } from '~/components/portal/establishment_editor/editor_field'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { MainLayout } from '~/layouts/main_layout'
import { useUnsavedChangesGuard } from '~/hooks/use_unsaved_changes_guard'
import { firstError } from '~/lib/form_errors'
import { formatCnpj, formatPhoneBR } from '~/lib/br_format'
import { getRevisionStatusMeta } from '~/lib/establishment_editor'
import { organizationRoleLabel, organizationStatusLabel } from '~/lib/labels'
import { cn } from '~/lib/utils'
import type { OrganizationAllowedActions } from '~/types'

interface EstablishmentSummary {
  id: number
  public_name: string
  lifecycle_status: string
  business_status: string
  revision: Record<string, unknown> | null
  published_revision: Record<string, unknown> | null
  completeness: {
    score: number
    eligible: boolean
    blocking_issues: Array<{ code: string; message: string }>
  }
}

interface OrganizationSummary {
  id: number
  legal_name: string
  trade_name: string
  slug: string
  tax_id: string
  email: string
  phone: string
  website: string | null
  status: string
  role: string | null
  establishments: EstablishmentSummary[]
  totals: {
    establishments: number
    published: number
    pending_review: number
    complete: number
  }
}

interface FeedbackTarget {
  id: number
  label: string
  organization_id?: number
}

interface OrganizationPageProps {
  organization: OrganizationSummary
  feedback_targets: {
    organizations: FeedbackTarget[]
    establishments: FeedbackTarget[]
  }
  allowed_actions: OrganizationAllowedActions
  errors?: Record<string, unknown>
}

interface OrganizationFormData {
  legal_name: string
  trade_name: string
  slug: string
  tax_id: string
  email: string
  phone: string
  website: string
}

type OrganizationOperation = 'save' | 'submit'

const submittableStatuses = new Set(['draft', 'changes_requested'])
const editableStatuses = new Set(['draft', 'changes_requested', 'active'])
const openRevisionStatuses = new Set(['draft', 'pending_review', 'changes_requested'])

/** An open workflow outranks the publication it will replace. */
function establishmentStatusMeta(establishment: EstablishmentSummary) {
  const status = establishment.revision?.status
  if (typeof status === 'string' && openRevisionStatuses.has(status)) {
    return getRevisionStatusMeta(status)
  }
  if (establishment.published_revision) return getRevisionStatusMeta('published')
  if (typeof status === 'string') return getRevisionStatusMeta(status)

  return { ...getRevisionStatusMeta('draft'), label: 'Ainda não publicado' }
}

function organizationStatusVariant(status: string) {
  if (status === 'active') return 'success' as const
  if (status === 'pending_review') return 'info' as const
  if (status === 'changes_requested') return 'warning' as const
  if (status === 'rejected' || status === 'suspended') return 'destructive' as const
  return 'neutral' as const
}

function hasOpenRevisionAlongsidePublication(establishment: EstablishmentSummary): boolean {
  const status = establishment.revision?.status
  return (
    establishment.published_revision !== null &&
    typeof status === 'string' &&
    openRevisionStatuses.has(status)
  )
}

export default function PortalOrganizationPage({
  organization,
  feedback_targets,
  allowed_actions: allowedActions,
  errors: pageErrors = {},
}: OrganizationPageProps) {
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const operationRef = useRef<OrganizationOperation | null>(null)
  const [operation, setOperation] = useState<OrganizationOperation | null>(null)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [localStatus, setLocalStatus] = useState<string | null>(null)
  // Legal data sits behind a disclosure once the organization is approved (web audit
  // W18); while it still has to be completed and sent, it starts open.
  const [dataOpen, setDataOpen] = useState(
    () =>
      submittableStatuses.has(organization.status) ||
      Object.keys(pageErrors).some((key) => key !== 'submission')
  )
  const form = useForm<OrganizationFormData>({
    legal_name: organization.legal_name,
    trade_name: organization.trade_name,
    slug: organization.slug,
    tax_id: formatCnpj(organization.tax_id),
    email: organization.email,
    phone: formatPhoneBR(organization.phone),
    website: organization.website ?? '',
  })
  const editable = editableStatuses.has(organization.status) && allowedActions.organizations.update
  const legalIdentityEditable =
    submittableStatuses.has(organization.status) && allowedActions.organizations.update
  const canSubmit =
    submittableStatuses.has(organization.status) && allowedActions.organizations.submit
  const canCreateEstablishment = allowedActions.establishments.create
  const canReadAnalytics = allowedActions.analytics.read
  const canCreateFeedback = allowedActions.pilot_feedback.create
  const formErrors = form.errors as Record<string, unknown>
  const busy = operation !== null || form.processing
  const guard = useUnsavedChangesGuard({
    enabled: () => editable && form.isDirty && operationRef.current === null,
  })

  const generalFormError = firstError(
    formErrors.general ?? formErrors.organization ?? pageErrors.general
  )
  const pageSubmissionError = firstError(
    pageErrors.submission ?? pageErrors.organization_review ?? pageErrors.review
  )
  const visibleSubmissionError = submissionError ?? pageSubmissionError

  function fieldError(field: keyof OrganizationFormData) {
    return firstError(formErrors[field] ?? pageErrors[field])
  }

  function beginOperation(next: OrganizationOperation) {
    if (operationRef.current) return false

    operationRef.current = next
    setOperation(next)
    return true
  }

  function finishOperation() {
    operationRef.current = null
    setOperation(null)
  }

  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!beginOperation('save')) return

    setLocalStatus(null)
    setSubmissionError(null)
    guard.allowNextVisit()
    form.transform((data) =>
      organization.status === 'active'
        ? {
            trade_name: data.trade_name,
            email: data.email,
            phone: data.phone,
            website: data.website,
          }
        : data
    )
    form.put(`/portal/organizations/${organization.id}`, {
      preserveScroll: true,
      onSuccess: () => {
        form.setDefaults()
        setLocalStatus('Dados da organização salvos com sucesso.')
      },
      onFinish: finishOperation,
    })
  }

  function discardChanges() {
    if (!form.isDirty || guard.confirmDiscard()) {
      form.reset()
      form.clearErrors()
      setLocalStatus(null)
      setSubmissionError(null)
    }
  }

  function openSubmissionDialog() {
    if (!canSubmit) return
    if (form.isDirty) {
      saveButtonRef.current?.focus()
      return
    }

    setSubmissionError(null)
    setSubmitDialogOpen(true)
  }

  function submitForReview() {
    if (!canSubmit || form.isDirty || !beginOperation('submit')) return

    setSubmissionError(null)
    setLocalStatus(null)
    guard.allowNextVisit()
    router.post(
      `/portal/organizations/${organization.id}/submit`,
      {},
      {
        preserveScroll: true,
        onSuccess: () => {
          setLocalStatus('Organização enviada para análise.')
        },
        onError: (visitErrors) => {
          setSubmissionError(
            firstError(visitErrors) ?? 'Não foi possível enviar a organização para análise.'
          )
        },
        onFinish: () => {
          finishOperation()
          setSubmitDialogOpen(false)
        },
      }
    )
  }

  const dataVisible = dataOpen || form.isDirty || Object.keys(formErrors).length > 0

  const places = (
    <section className="space-y-4" aria-labelledby="organization-establishments-title">
      <div>
        <h2
          id="organization-establishments-title"
          className="font-display text-xl font-bold tracking-[-0.02em]"
        >
          Lugares
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada lugar tem dados, fotos e publicação próprios no app e no site.
        </p>
      </div>

      {organization.establishments.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card">
          <EmptyState
            icon={Building2}
            headingLevel={3}
            title="Nenhum lugar cadastrado"
            description="Cadastre um lugar para cada endereço onde a organização recebe o público."
          >
            {canCreateEstablishment ? (
              <Button asChild variant="outline" size="lg" shape="pill">
                <Link href={`/portal/organizations/${organization.id}/establishments/new`}>
                  Cadastrar o primeiro lugar
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            ) : null}
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {organization.establishments.map((establishment) => {
            const score = Math.min(100, Math.max(0, establishment.completeness.score))
            const statusMeta = establishmentStatusMeta(establishment)

            return (
              <Link
                key={establishment.id}
                href={`/portal/establishments/${establishment.id}`}
                className="group flex flex-col rounded-card border border-border-subtle bg-card p-5 outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.01em]">
                      <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{establishment.public_name}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-bold',
                          statusMeta.className
                        )}
                      >
                        {statusMeta.label}
                      </span>
                      {hasOpenRevisionAlongsidePublication(establishment) ? (
                        <span className="text-xs text-muted-foreground">
                          Versão publicada continua no ar
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-lg font-bold tabular-nums">
                    {score}%
                  </span>
                </div>
                <div
                  className="mt-4 h-2 overflow-hidden rounded-full bg-border-subtle"
                  role="progressbar"
                  aria-label={`Dados preenchidos de ${establishment.public_name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={score}
                >
                  <div
                    className={cn(
                      'h-full rounded-full',
                      establishment.completeness.eligible ? 'bg-success' : 'bg-primary'
                    )}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                  Ver dados do lugar
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )

  return (
    <MainLayout>
      <Head title={organization.trade_name} />

      <div className="space-y-7">
        <Button asChild variant="ghost" size="md" shape="pill" className="-ms-3">
          <Link href="/portal">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar à visão geral
          </Link>
        </Button>

        <PageHeader
          eyebrow={`Organização · ${organizationRoleLabel(organization.role)}`}
          title={organization.trade_name}
          description={organization.legal_name}
          meta={
            <Badge
              variant={organizationStatusVariant(organization.status)}
              appearance="light"
              shape="pill"
              size="lg"
            >
              {organizationStatusLabel(organization.status)}
            </Badge>
          }
          actions={
            <>
              {canReadAnalytics ? (
                <Button asChild variant="outline" size="lg" shape="pill">
                  <Link href={`/organizations/${organization.id}/analytics`}>
                    <BarChart3 aria-hidden="true" className="size-4" />
                    Desempenho
                  </Link>
                </Button>
              ) : null}
              {canCreateEstablishment ? (
                <Button asChild size="xl" shape="pill">
                  <Link href={`/portal/organizations/${organization.id}/establishments/new`}>
                    <Plus aria-hidden="true" className="size-4" />
                    Novo lugar
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        <section
          aria-label="Indicadores da organização"
          className="grid grid-cols-2 gap-3 xl:grid-cols-4"
        >
          {[
            ['Lugares', organization.totals.establishments],
            ['Completos', organization.totals.complete],
            ['Em análise', organization.totals.pending_review],
            ['Publicados', organization.totals.published],
          ].map(([label, value]) => (
            <article
              key={label}
              className="rounded-card border border-border-subtle bg-card p-4 sm:p-5"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 font-display text-3xl font-extrabold tabular-nums">{value}</p>
            </article>
          ))}
        </section>

        {places}

        <section
          className="rounded-card border border-border-subtle bg-card"
          aria-labelledby="organization-data-title"
        >
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div className="min-w-0">
              <h2
                id="organization-data-title"
                className="font-display text-xl font-bold tracking-[-0.02em]"
              >
                Dados da organização
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Razão social, CNPJ e contatos. Ficam privados e são conferidos pela equipe do
                Experimente+.
              </p>
              {!dataVisible ? (
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">CNPJ</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatCnpj(organization.tax_id)}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Telefone</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatPhoneBR(organization.phone)}
                    </dd>
                  </div>
                  <div className="flex min-w-0 gap-1.5">
                    <dt className="text-muted-foreground">E-mail</dt>
                    <dd className="truncate font-semibold">{organization.email}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              shape="pill"
              className="shrink-0 self-start"
              aria-expanded={dataVisible}
              aria-controls="organization-data-panel"
              disabled={form.isDirty}
              onClick={() => setDataOpen(!dataVisible)}
            >
              {dataVisible ? 'Ocultar dados' : editable ? 'Ver e editar dados' : 'Ver dados'}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'size-4 transition-transform motion-reduce:transition-none',
                  dataVisible && 'rotate-180'
                )}
              />
            </Button>
          </div>

          <form
            id="organization-data-panel"
            hidden={!dataVisible}
            onSubmit={update}
            className="space-y-5 border-t border-border-subtle p-5 sm:p-6"
            aria-busy={busy}
            aria-labelledby="organization-data-title"
          >
            {generalFormError ? (
              <Alert variant="destructive" role="alert">
                <AlertTitle>Não foi possível salvar os dados</AlertTitle>
                <AlertDescription>{generalFormError}</AlertDescription>
              </Alert>
            ) : null}

            {visibleSubmissionError ? (
              <Alert variant="destructive" role="alert">
                <AlertTitle>Não foi possível enviar para análise</AlertTitle>
                <AlertDescription>{visibleSubmissionError}</AlertDescription>
              </Alert>
            ) : null}

            {localStatus ? (
              <Alert role="status" aria-live="polite">
                <AlertTitle>Operação concluída</AlertTitle>
                <AlertDescription>{localStatus}</AlertDescription>
              </Alert>
            ) : null}

            {editable && form.isDirty ? (
              <Alert role="status">
                <AlertTitle>Existem alterações não salvas</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    {canSubmit
                      ? 'Salve ou descarte os dados antes de enviar a organização para análise.'
                      : 'Salve ou descarte os dados para concluir a atualização.'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    shape="pill"
                    onClick={() => saveButtonRef.current?.focus()}
                  >
                    Ir para salvar
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            {/* Bottom-aligned: a hint that wraps under one label must not drop only its input. */}
            <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <EditorField
                htmlFor="organization-legal-name"
                label="Razão social"
                required
                error={fieldError('legal_name')}
              >
                <Input
                  id="organization-legal-name"
                  name="legal_name"
                  required
                  maxLength={180}
                  autoComplete="organization"
                  disabled={!legalIdentityEditable || busy}
                  value={form.data.legal_name}
                  onChange={(event) => form.setData('legal_name', event.target.value)}
                />
              </EditorField>

              <EditorField
                htmlFor="organization-trade-name"
                label="Nome fantasia"
                required
                error={fieldError('trade_name')}
              >
                <Input
                  id="organization-trade-name"
                  name="trade_name"
                  required
                  maxLength={160}
                  autoComplete="organization"
                  disabled={!editable || busy}
                  value={form.data.trade_name}
                  onChange={(event) => form.setData('trade_name', event.target.value)}
                />
              </EditorField>

              <EditorField
                htmlFor="organization-slug"
                label="Endereço da página"
                hint="Identificador curto usado no endereço público da organização."
                error={fieldError('slug')}
              >
                <Input
                  id="organization-slug"
                  name="slug"
                  maxLength={180}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!legalIdentityEditable || busy}
                  value={form.data.slug}
                  onChange={(event) => form.setData('slug', event.target.value)}
                />
              </EditorField>

              <EditorField
                htmlFor="organization-tax-id"
                label="CNPJ"
                hint="Só números ou no formato 00.000.000/0000-00."
                required
                error={fieldError('tax_id')}
              >
                <Input
                  id="organization-tax-id"
                  name="tax_id"
                  required
                  maxLength={18}
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={!legalIdentityEditable || busy}
                  value={form.data.tax_id}
                  onChange={(event) => form.setData('tax_id', event.target.value)}
                  onBlur={(event) => form.setData('tax_id', formatCnpj(event.target.value))}
                />
              </EditorField>

              <EditorField
                htmlFor="organization-email"
                label="E-mail"
                required
                error={fieldError('email')}
              >
                <Input
                  id="organization-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  disabled={!editable || busy}
                  value={form.data.email}
                  onChange={(event) => form.setData('email', event.target.value)}
                />
              </EditorField>

              <EditorField
                htmlFor="organization-phone"
                label="Telefone"
                required
                error={fieldError('phone')}
              >
                <Input
                  id="organization-phone"
                  name="phone"
                  type="tel"
                  required
                  minLength={10}
                  maxLength={20}
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={!editable || busy}
                  value={form.data.phone}
                  onChange={(event) => form.setData('phone', event.target.value)}
                  onBlur={(event) => form.setData('phone', formatPhoneBR(event.target.value))}
                />
              </EditorField>
            </div>

            <EditorField
              htmlFor="organization-website"
              label="Website"
              hint="Opcional. Informe a URL completa, incluindo https://."
              error={fieldError('website')}
            >
              <Input
                id="organization-website"
                name="website"
                type="url"
                maxLength={2048}
                autoComplete="url"
                placeholder="https://exemplo.com.br"
                disabled={!editable || busy}
                value={form.data.website}
                onChange={(event) => form.setData('website', event.target.value)}
              />
            </EditorField>

            {editable ? (
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  shape="pill"
                  disabled={busy || !form.isDirty}
                  onClick={discardChanges}
                >
                  Descartar alterações
                </Button>
                <Button
                  ref={saveButtonRef}
                  type="submit"
                  variant="outline"
                  size="lg"
                  shape="pill"
                  disabled={busy || !form.isDirty}
                >
                  {operation === 'save' || form.processing ? (
                    <>
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      Salvando…
                    </>
                  ) : (
                    <>
                      <Save aria-hidden="true" className="size-4" />
                      Salvar dados
                    </>
                  )}
                </Button>
                {canSubmit ? (
                  <Button
                    type="button"
                    size="lg"
                    shape="pill"
                    disabled={busy || form.isDirty}
                    onClick={openSubmissionDialog}
                  >
                    <Send aria-hidden="true" className="size-4" />
                    Enviar para análise
                  </Button>
                ) : null}
              </div>
            ) : null}
          </form>
        </section>

        {canCreateFeedback ? (
          <PilotFeedbackForm
            targets={feedback_targets}
            context="organization"
            organizationId={organization.id}
          />
        ) : null}
      </div>

      <ConfirmDialog
        open={submitDialogOpen}
        onOpenChange={(open) => {
          if (!busy) setSubmitDialogOpen(open)
        }}
        title="Enviar organização para análise?"
        description="Os dados salvos vão para a equipe do Experimente+. Durante a análise, a edição pode ficar indisponível por um tempo."
        confirmLabel="Enviar para análise"
        processing={operation === 'submit'}
        disabled={busy && operation !== 'submit'}
        onConfirm={submitForReview}
      />
    </MainLayout>
  )
}
