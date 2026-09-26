import { Head, Link } from '@inertiajs/react'
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleDashed,
  MapPin,
  Plus,
  ReceiptText,
  ScanLine,
} from 'lucide-react'

import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import PilotFeedbackForm from '~/components/portal/pilot_feedback_form'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { TaskCard } from '~/components/ui/task-card'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts/main_layout'
import { organizationRoleLabel, organizationStatusLabel } from '~/lib/labels'
import { PLACE_STATE, type PlaceState } from '~/lib/partner_places'
import { greeting, todayOverline } from '~/lib/today'
import { cn } from '~/lib/utils'
import type { OrganizationAllowedActions } from '~/types'

interface Completeness {
  score: number
  eligible: boolean
}

interface EstablishmentSummary {
  id: number
  public_name: string
  published_revision_id: number | null
  lifecycle_status: string
  business_status: string
  completeness: Completeness | null
}

interface OnboardingStep {
  key: string
  label: string
  completed: boolean
  href: string
  available: boolean
}

interface OrganizationSummary {
  id: number
  legal_name: string
  trade_name: string
  status: string
  role: string | null
  allowed_actions: OrganizationAllowedActions
  establishments: EstablishmentSummary[]
  totals: {
    establishments: number
    published: number
    pending_review: number
    complete: number
  }
  onboarding: OnboardingStep[]
}

interface Overview {
  organizations: OrganizationSummary[]
  totals: {
    organizations: number
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

/** The overview's task cards; every count comes from the server. */
interface PortalTasks {
  unanswered_reviews: number
  places: Record<PlaceState, number> & { total: number }
  content: { pending_review: number; draft: number; published: number }
}

interface PortalIndexProps {
  overview: Overview
  tasks: PortalTasks
  allowed_actions: OrganizationAllowedActions
  feedback_targets: {
    organizations: FeedbackTarget[]
    establishments: FeedbackTarget[]
  }
}

type StatusTone = 'success' | 'warning' | 'info' | 'neutral' | 'destructive'

/** Direction A status colours: green live, blue in review, amber waiting on the partner. */
function statusTone(status: string): StatusTone {
  const tones: Record<string, StatusTone> = {
    active: 'success',
    pending_review: 'info',
    changes_requested: 'warning',
    suspended: 'destructive',
    rejected: 'destructive',
  }

  return tones[status] ?? 'neutral'
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? `1 ${one}` : `${count} ${many}`
}

/** The place state that asks for the partner first: a correction, then a wait, then live. */
function placesHeadline(places: PortalTasks['places']): PlaceState {
  if (places.changes_requested > 0) return 'changes_requested'
  if (places.pending_review > 0) return 'pending_review'
  if (places.published > 0) return 'published'
  return 'draft'
}

export default function PartnerPortalIndex({
  overview,
  tasks,
  allowed_actions: allowedActions,
  feedback_targets,
}: PortalIndexProps) {
  const { can } = useAuth()
  const canCreateOrganization = can('organizations.create')
  const canCreateFeedback = can('pilot_feedback.create')
  const canReadRedemptions = allowedActions.redemptions.read
  const canValidateRedemptions = allowedActions.redemptions.validate
  const canReadPlaces = overview.organizations.some(
    (organization) => organization.allowed_actions.establishments.read
  )
  const headline = placesHeadline(tasks.places)
  const soleOrganization =
    overview.organizations.length === 1 ? overview.organizations[0].trade_name : null

  return (
    <MainLayout>
      <Head title="Visão geral" />

      <div className="space-y-7">
        <PageHeader
          eyebrow={todayOverline()}
          title={soleOrganization ? `${greeting()}, ${soleOrganization}` : greeting()}
          description="O que pede sua atenção hoje, seus lugares e o que está em análise."
          className="sm:items-end"
          actions={
            <>
              {/* The day's main action leads on a phone and for assistive tech; on wider
                  screens it closes the row, where the eye ends. */}
              {canValidateRedemptions ? (
                <Button asChild variant="cta" size="2xl" shape="pill" className="sm:order-last">
                  <Link href="/portal/redemptions/validate">
                    <ScanLine aria-hidden="true" className="size-5" />
                    Validar benefício
                  </Link>
                </Button>
              ) : null}
              {canReadRedemptions ? (
                <Button asChild variant="outline" size="lg" shape="pill">
                  <Link href="/portal/redemptions">
                    <ReceiptText aria-hidden="true" />
                    Utilizações
                  </Link>
                </Button>
              ) : null}
              {canCreateOrganization && overview.organizations.length > 0 ? (
                <Button asChild variant="outline" size="lg" shape="pill">
                  <Link href="/portal/organizations/new">
                    <Plus aria-hidden="true" />
                    Nova organização
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        {canReadPlaces ? (
          <section aria-label="Tarefas de hoje" className="grid gap-5 md:grid-cols-3">
            <TaskCard
              title="Avaliações sem resposta"
              value={tasks.unanswered_reviews}
              tone={tasks.unanswered_reviews > 0 ? 'primary' : 'muted'}
              description={
                tasks.unanswered_reviews > 0
                  ? 'Responder mostra cuidado a quem lê as avaliações.'
                  : 'Nenhuma avaliação esperando resposta.'
              }
              href="/portal/reviews"
              actionLabel={tasks.unanswered_reviews > 0 ? 'Responder agora' : 'Ver avaliações'}
            />

            <TaskCard
              title="Dados do lugar"
              href="/portal/establishments"
              actionLabel="Editar dados"
              description={
                tasks.places.total === 0
                  ? 'Nenhum lugar cadastrado ainda.'
                  : [
                      plural(tasks.places.published, 'publicado', 'publicados'),
                      tasks.places.pending_review > 0
                        ? plural(tasks.places.pending_review, 'em análise', 'em análise')
                        : null,
                      tasks.places.changes_requested > 0
                        ? plural(
                            tasks.places.changes_requested,
                            'com correções pedidas',
                            'com correções pedidas'
                          )
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
              }
            >
              <Badge
                variant={PLACE_STATE[headline].variant}
                appearance="light"
                shape="pill"
                size="lg"
                className="h-9 self-start px-3.5 text-base font-extrabold [&_svg]:size-4"
              >
                {headline === 'published' ? <Check aria-hidden="true" strokeWidth={2.6} /> : null}
                {PLACE_STATE[headline].label}
              </Badge>
            </TaskCard>

            <TaskCard
              title="Experiências e eventos"
              href="/portal/content"
              actionLabel="Ver experiências e eventos"
              description={`${plural(tasks.content.published, 'publicado', 'publicados')} no app e no site.`}
            >
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="info"
                  appearance="light"
                  shape="pill"
                  size="lg"
                  className="h-8 text-sm font-bold"
                >
                  {tasks.content.pending_review} em análise
                </Badge>
                <Badge
                  variant="neutral"
                  shape="pill"
                  size="lg"
                  className="h-8 text-sm font-bold text-foreground"
                >
                  {plural(tasks.content.draft, 'rascunho', 'rascunhos')}
                </Badge>
              </div>
            </TaskCard>
          </section>
        ) : null}

        {overview.organizations.length === 0 ? (
          <EmptyState
            className="rounded-card border border-dashed border-border bg-card"
            headingLevel={2}
            icon={Building2}
            title={
              canCreateOrganization ? 'Comece pela organização' : 'Nenhuma organização disponível'
            }
            description={
              canCreateOrganization
                ? 'Cadastre a identidade legal da empresa. Depois você poderá criar um ou vários lugares em cidades diferentes.'
                : 'Não há organizações disponíveis para o seu acesso na operação ativa.'
            }
          >
            {canCreateOrganization ? (
              <Button asChild variant="primary" size="xl" shape="pill">
                <Link href="/portal/organizations/new">
                  Criar organização
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-[1.3125rem] font-extrabold tracking-[-0.01em]">
                  Organizações disponíveis
                </h2>
                <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                  As informações e ações variam conforme o perfil de acesso em cada organização.
                </p>
              </div>
              <p className="text-[0.8125rem] font-medium text-muted-foreground">
                {overview.organizations.length} na operação ativa
              </p>
            </div>

            <div
              className={cn('grid gap-5', overview.organizations.length > 1 && 'xl:grid-cols-2')}
            >
              {overview.organizations.map((organization) => {
                const completedSteps = organization.onboarding.filter(
                  (step) => step.completed
                ).length
                const progress = organization.onboarding.length
                  ? Math.round((completedSteps / organization.onboarding.length) * 100)
                  : 0

                return (
                  <article
                    key={organization.id}
                    className="overflow-hidden rounded-card border border-border-subtle bg-card"
                  >
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-display text-lg font-bold tracking-[-0.01em]">
                              {organization.trade_name}
                            </h3>
                            <Badge
                              variant={statusTone(organization.status)}
                              appearance="light"
                              shape="pill"
                              size="md"
                              className="font-bold"
                            >
                              {organizationStatusLabel(organization.status)}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {organization.legal_name}
                          </p>
                          <p className="mt-1 text-[0.8125rem] font-semibold text-primary">
                            {organizationRoleLabel(organization.role)}
                          </p>
                        </div>
                        {organization.allowed_actions.organizations.read ? (
                          <Button asChild variant="outline" size="md" shape="pill">
                            <Link href={`/portal/organizations/${organization.id}`}>
                              Abrir
                              <ArrowRight aria-hidden="true" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>

                      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
                        {[
                          ['lugares', organization.totals.establishments],
                          ['completas', organization.totals.complete],
                          ['publicadas', organization.totals.published],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="flex flex-col-reverse rounded-2xl bg-background p-3"
                          >
                            <dt className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                              {label}
                            </dt>
                            <dd className="font-display text-2xl font-extrabold tabular-nums">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      {progress === 100 ? (
                        <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-success-accent">
                          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
                          Configuração concluída
                        </p>
                      ) : (
                        <div className="mt-6">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">Progresso da configuração</span>
                            <span className="font-semibold tabular-nums text-primary">
                              {progress}%
                            </span>
                          </div>
                          <div
                            className="mt-2 h-2 overflow-hidden rounded-full bg-border-subtle"
                            role="progressbar"
                            aria-label={`Progresso da configuração de ${organization.trade_name}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress}
                          >
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="mt-2 text-[0.8125rem] text-muted-foreground">
                            {completedSteps} de {organization.onboarding.length} etapas concluídas
                          </p>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {organization.onboarding.map((step) => {
                              const className = cn(
                                'flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                                step.completed
                                  ? 'border-transparent bg-success-soft text-foreground'
                                  : 'border-border-subtle hover:border-border hover:bg-muted'
                              )
                              const content = (
                                <>
                                  {step.completed ? (
                                    <CheckCircle2
                                      aria-hidden="true"
                                      className="size-4 shrink-0 text-success-accent"
                                    />
                                  ) : (
                                    <CircleDashed
                                      aria-hidden="true"
                                      className="size-4 shrink-0 text-muted-foreground"
                                    />
                                  )}
                                  <span>{step.label}</span>
                                </>
                              )

                              return step.available ? (
                                <Link key={step.key} href={step.href} className={className}>
                                  {content}
                                </Link>
                              ) : (
                                <div
                                  key={step.key}
                                  className={cn(className, 'pointer-events-none opacity-65')}
                                >
                                  {content}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {organization.allowed_actions.establishments.read &&
                      organization.establishments.length > 0 && (
                        <div className="border-t border-border-subtle px-5 py-4 sm:px-6">
                          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                            Lugares
                          </p>
                          <div className="space-y-1">
                            {organization.establishments.slice(0, 3).map((establishment) => (
                              <Link
                                key={establishment.id}
                                href={`/portal/establishments/${establishment.id}`}
                                className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <MapPin
                                    aria-hidden="true"
                                    className="size-4 shrink-0 text-muted-foreground"
                                  />
                                  <span className="truncate text-[0.9375rem] font-medium">
                                    {establishment.public_name || `Lugar ${establishment.id}`}
                                  </span>
                                </span>
                                <span className="text-[0.8125rem] font-semibold tabular-nums text-muted-foreground">
                                  {establishment.completeness?.score ?? 0}%
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {canCreateFeedback ? (
          <PilotFeedbackForm targets={feedback_targets} context="onboarding" />
        ) : null}
      </div>
    </MainLayout>
  )
}
