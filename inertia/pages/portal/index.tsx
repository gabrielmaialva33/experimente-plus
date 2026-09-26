import { Head, Link } from '@inertiajs/react'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  MapPin,
  MessageSquareText,
  Plus,
  ReceiptText,
  ScanLine,
  Store,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import PilotFeedbackForm from '~/components/portal/pilot_feedback_form'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts/main_layout'
import { organizationRoleLabel, organizationStatusLabel } from '~/lib/labels'
import { PLACE_STATE, type PlaceState } from '~/lib/partner_places'
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

function statusClassName(status: string): string {
  const styles: Record<string, string> = {
    draft: 'border-border bg-muted text-muted-foreground',
    pending_review: 'border-warning/25 bg-warning/15 text-warning-foreground',
    changes_requested: 'border-warning/25 bg-warning/15 text-warning-foreground',
    active: 'border-success/25 bg-success/10 text-success',
    suspended: 'border-destructive/25 bg-destructive/10 text-destructive',
    rejected: 'border-destructive/25 bg-destructive/10 text-destructive',
    archived: 'border-border bg-muted text-muted-foreground',
  }

  return styles[status] ?? 'border-border bg-muted text-muted-foreground'
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

  return (
    <MainLayout>
      <Head title="Visão geral" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Portal do parceiro"
          icon={Store}
          title="Visão geral"
          description="O que pede sua atenção hoje, seus lugares e o que está em análise."
          actions={
            <>
              {canValidateRedemptions ? (
                <Button asChild variant="cta">
                  <Link href="/portal/redemptions/validate">
                    <ScanLine aria-hidden="true" className="size-4" />
                    Validar benefício
                  </Link>
                </Button>
              ) : null}
              {canReadRedemptions ? (
                <Button asChild variant="outline">
                  <Link href="/portal/redemptions">
                    <ReceiptText aria-hidden="true" className="size-4" />
                    Utilizações
                  </Link>
                </Button>
              ) : null}
              {canCreateOrganization && overview.organizations.length > 0 ? (
                <Button asChild variant="outline">
                  <Link href="/portal/organizations/new">
                    <Plus aria-hidden="true" className="size-4" />
                    Nova organização
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        {canReadPlaces ? (
          <section aria-label="Tarefas de hoje" className="grid gap-4 md:grid-cols-3">
            <TaskCard
              title="Avaliações sem resposta"
              href="/portal/reviews"
              action={tasks.unanswered_reviews > 0 ? 'Responder agora' : 'Ver avaliações'}
              icon={MessageSquareText}
            >
              <p className="text-4xl font-extrabold tabular-nums text-primary-accent">
                {tasks.unanswered_reviews}
              </p>
              <p className="text-sm text-muted-foreground">
                {tasks.unanswered_reviews > 0
                  ? 'Responder mostra cuidado a quem lê as avaliações.'
                  : 'Nenhuma avaliação esperando resposta.'}
              </p>
            </TaskCard>

            <TaskCard
              title="Dados do lugar"
              href="/portal/establishments"
              action="Editar dados"
              icon={MapPin}
            >
              <Badge
                variant={PLACE_STATE[headline].variant}
                appearance="light"
                className="self-start"
              >
                {PLACE_STATE[headline].label}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {tasks.places.total === 0
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
                      .join(' · ')}
              </p>
            </TaskCard>

            <TaskCard
              title="Experiências e eventos"
              href="/portal/content"
              action="Ver experiências e eventos"
              icon={CalendarDays}
            >
              <div className="flex flex-wrap gap-2">
                <Badge variant="info" appearance="light">
                  {tasks.content.pending_review} em análise
                </Badge>
                <Badge variant="secondary" appearance="light">
                  {plural(tasks.content.draft, 'rascunho', 'rascunhos')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {plural(tasks.content.published, 'publicado', 'publicados')} no app e no site.
              </p>
            </TaskCard>
          </section>
        ) : null}

        {overview.organizations.length === 0 ? (
          <EmptyState
            className="rounded-lg border border-dashed border-border bg-card"
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
              <Button asChild variant="primary">
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
                <h2 className="text-lg font-bold tracking-[-0.02em]">Organizações disponíveis</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  As informações e ações variam conforme o perfil de acesso em cada organização.
                </p>
              </div>
              <p className="text-xs font-medium text-muted-foreground">
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
                    className="overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-bold tracking-[-0.025em]">
                              {organization.trade_name}
                            </h3>
                            <span
                              className={cn(
                                'rounded-md border px-2.5 py-1 text-[0.68rem] font-semibold',
                                statusClassName(organization.status)
                              )}
                            >
                              {organizationStatusLabel(organization.status)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {organization.legal_name}
                          </p>
                          <p className="mt-1 text-xs font-medium text-primary">
                            {organizationRoleLabel(organization.role)}
                          </p>
                        </div>
                        {organization.allowed_actions.organizations.read ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/portal/organizations/${organization.id}`}>
                              Abrir
                              <ArrowRight className="size-3.5" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>

                      <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-md border border-border bg-muted/35 text-center">
                        <div className="p-3">
                          <p className="text-xl font-bold tabular-nums">
                            {organization.totals.establishments}
                          </p>
                          <p className="mt-0.5 text-[0.68rem] text-muted-foreground">lugares</p>
                        </div>
                        <div className="border-x border-border/70 p-3">
                          <p className="text-xl font-bold tabular-nums">
                            {organization.totals.complete}
                          </p>
                          <p className="mt-0.5 text-[0.68rem] text-muted-foreground">completas</p>
                        </div>
                        <div className="p-3">
                          <p className="text-xl font-bold tabular-nums">
                            {organization.totals.published}
                          </p>
                          <p className="mt-0.5 text-[0.68rem] text-muted-foreground">publicadas</p>
                        </div>
                      </div>

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
                            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
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
                          <p className="mt-2 text-xs text-muted-foreground">
                            {completedSteps} de {organization.onboarding.length} etapas concluídas
                          </p>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {organization.onboarding.map((step) => {
                              const className = cn(
                                'flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                step.completed
                                  ? 'border-success/20 bg-success/[0.06] text-foreground hover:bg-success/10'
                                  : 'border-border hover:border-primary/25 hover:bg-accent/50'
                              )
                              const content = (
                                <>
                                  {step.completed ? (
                                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                                  ) : (
                                    <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
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
                        <div className="border-t border-border/70 bg-muted/20 px-5 py-4 sm:px-6">
                          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Lugares
                          </p>
                          <div className="space-y-1">
                            {organization.establishments.slice(0, 3).map((establishment) => (
                              <Link
                                key={establishment.id}
                                href={`/portal/establishments/${establishment.id}`}
                                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                                  <span className="truncate text-sm font-medium">
                                    {establishment.public_name || `Lugar ${establishment.id}`}
                                  </span>
                                </span>
                                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
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

function TaskCard({
  title,
  href,
  action,
  icon: Icon,
  children,
}: {
  title: string
  href: string
  action: string
  icon: typeof Store
  children: ReactNode
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
        {title}
      </h2>
      {children}
      <Link
        href={href}
        className="mt-auto inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-primary-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {action}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </article>
  )
}
