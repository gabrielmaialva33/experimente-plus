import { Head, Link, router, useForm } from '@inertiajs/react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
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
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { MainLayout } from '~/layouts/main_layout'
import { useUnsavedChangesGuard } from '~/hooks/use_unsaved_changes_guard'
import { firstError } from '~/lib/form_errors'
import { organizationRoleLabel, organizationStatusLabel, revisionStatusLabel } from '~/lib/labels'
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

const editableStatuses = new Set(['draft', 'changes_requested'])

function establishmentRevisionStatus(establishment: EstablishmentSummary): string {
  if (establishment.published_revision) return 'Publicada'

  const status = establishment.revision?.status
  return typeof status === 'string' ? revisionStatusLabel(status) : 'Ainda não publicada'
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
  const form = useForm<OrganizationFormData>({
    legal_name: organization.legal_name,
    trade_name: organization.trade_name,
    slug: organization.slug,
    tax_id: organization.tax_id,
    email: organization.email,
    phone: organization.phone,
    website: organization.website ?? '',
  })
  const statusEditable = editableStatuses.has(organization.status)
  const editable = statusEditable && allowedActions.organizations.update
  const canSubmit = statusEditable && allowedActions.organizations.submit
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

  return (
    <MainLayout>
      <Head title={organization.trade_name} />

      <div className="space-y-8">
        <Button asChild variant="ghost" size="sm" className="-ms-3">
          <Link href="/portal">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar ao portal
          </Link>
        </Button>

        <PageHeader
          eyebrow={`Organização · ${organizationRoleLabel(organization.role)}`}
          icon={Building2}
          title={organization.trade_name}
          description={`${organization.legal_name} · ${organizationStatusLabel(organization.status)}`}
          actions={
            <>
              {canReadAnalytics ? (
                <Button asChild variant="outline">
                  <Link href={`/organizations/${organization.id}/analytics`}>
                    <BarChart3 aria-hidden="true" className="size-4" />
                    Ver analytics
                  </Link>
                </Button>
              ) : null}
              {canCreateEstablishment ? (
                <Button asChild>
                  <Link href={`/portal/organizations/${organization.id}/establishments/new`}>
                    <Plus aria-hidden="true" className="size-4" />
                    Nova unidade
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        <section
          aria-label="Indicadores da organização"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[
            ['Unidades', organization.totals.establishments],
            ['Completas', organization.totals.complete],
            ['Em análise', organization.totals.pending_review],
            ['Publicadas', organization.totals.published],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-bold">{value}</p>
            </article>
          ))}
        </section>

        <section
          className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"
          aria-labelledby="organization-data-title"
        >
          <form
            onSubmit={update}
            className="space-y-5 rounded-md border border-border bg-card p-6"
            aria-busy={busy}
          >
            <div>
              <h2 id="organization-data-title" className="text-xl font-semibold">
                Dados da organização
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Dados legais ficam privados e são revisados pela equipe da plataforma.
              </p>
            </div>

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
                  <p>Salve ou descarte os dados antes de enviar a organização para análise.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => saveButtonRef.current?.focus()}
                  >
                    Ir para salvar
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
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
                  disabled={!editable || busy}
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
                  disabled={!editable || busy}
                  value={form.data.slug}
                  onChange={(event) => form.setData('slug', event.target.value)}
                />
              </EditorField>

              <EditorField
                htmlFor="organization-tax-id"
                label="CNPJ"
                hint="A validação e a normalização finais permanecem no servidor."
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
                  disabled={!editable || busy}
                  value={form.data.tax_id}
                  onChange={(event) => form.setData('tax_id', event.target.value)}
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
                  disabled={busy || !form.isDirty}
                  onClick={discardChanges}
                >
                  Descartar alterações
                </Button>
                <Button
                  ref={saveButtonRef}
                  type="submit"
                  variant="outline"
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

          {canCreateFeedback ? (
            <PilotFeedbackForm
              targets={feedback_targets}
              context="organization"
              organizationId={organization.id}
            />
          ) : null}
        </section>

        <section className="space-y-4" aria-labelledby="organization-establishments-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="organization-establishments-title" className="text-xl font-semibold">
                Unidades
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada endereço público possui ficha, mídia e publicação próprias.
              </p>
            </div>
          </div>

          {organization.establishments.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-card">
              <EmptyState
                icon={Building2}
                title="Nenhuma unidade cadastrada"
                description="Crie uma unidade quando houver um endereço público vinculado a esta organização."
              >
                {canCreateEstablishment ? (
                  <Button asChild variant="outline">
                    <Link href={`/portal/organizations/${organization.id}/establishments/new`}>
                      Criar primeira unidade
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

                return (
                  <Link
                    key={establishment.id}
                    href={`/portal/establishments/${establishment.id}`}
                    className="rounded-2xl border border-border bg-card p-5 outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="flex items-center gap-2 font-semibold">
                          <MapPin aria-hidden="true" className="size-4 text-primary" />
                          {establishment.public_name}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {establishmentRevisionStatus(establishment)}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        {score}%
                      </span>
                    </div>
                    <div
                      className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={`Completude da ficha de ${establishment.public_name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={score}
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={submitDialogOpen}
        onOpenChange={(open) => {
          if (!busy) setSubmitDialogOpen(open)
        }}
        title="Enviar organização para análise?"
        description="Os dados atualmente salvos serão encaminhados para a equipe da plataforma. Durante a análise, a edição poderá ficar temporariamente indisponível."
        confirmLabel="Enviar para análise"
        processing={operation === 'submit'}
        disabled={busy && operation !== 'submit'}
        onConfirm={submitForReview}
      />
    </MainLayout>
  )
}
