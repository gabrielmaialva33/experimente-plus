import { Head, Link } from '@inertiajs/react'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleDashed,
  Clock3,
  MapPin,
  Plus,
  Store,
} from 'lucide-react'

import { MetricCard } from '~/components/metric_card'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import PilotFeedbackForm from '~/components/portal/pilot_feedback_form'
import { Button } from '~/components/ui/button'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts/main_layout'
import { organizationRoleLabel, organizationStatusLabel } from '~/lib/labels'
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

interface PortalIndexProps {
  overview: Overview
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

export default function PartnerPortalIndex({ overview, feedback_targets }: PortalIndexProps) {
  const { can } = useAuth()
  const canCreateOrganization = can('organizations.create')
  const canCreateFeedback = can('pilot_feedback.create')
  const stats = [
    {
      label: 'Organizações',
      value: overview.totals.organizations,
      icon: Building2,
      tone: 'primary' as const,
    },
    {
      label: 'Unidades',
      value: overview.totals.establishments,
      icon: Store,
      tone: 'info' as const,
      helper: `${overview.totals.complete} prontas para enviar para análise`,
    },
    {
      label: 'Publicadas',
      value: overview.totals.published,
      icon: BadgeCheck,
      tone: 'success' as const,
    },
    {
      label: 'Em análise',
      value: overview.totals.pending_review,
      icon: Clock3,
      tone: 'warning' as const,
    },
  ]

  return (
    <MainLayout>
      <Head title="Visão geral" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Portal do parceiro"
          icon={Store}
          title="Visão geral"
          description="Organize empresas e unidades, acompanhe a qualidade das fichas e envie conteúdo para moderação."
          actions={
            canCreateOrganization && overview.organizations.length > 0 ? (
              <Button asChild variant="primary">
                <Link href="/portal/organizations/new">
                  <Plus className="size-4" />
                  Nova organização
                </Link>
              </Button>
            ) : null
          }
        />

        <section
          aria-label="Indicadores do portal"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {stats.map((stat) => (
            <MetricCard
              key={stat.label}
              label={stat.label}
              value={stat.value.toLocaleString('pt-BR')}
              icon={stat.icon}
              tone={stat.tone}
              helper={stat.helper}
            />
          ))}
        </section>

        {overview.organizations.length === 0 ? (
          <EmptyState
            className="rounded-lg border border-dashed border-border bg-card"
            headingLevel={2}
            icon={Building2}
            title="Comece pela organização"
            description="Cadastre a identidade legal da empresa. Depois você poderá criar uma ou várias unidades em cidades diferentes."
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
                          <p className="mt-0.5 text-[0.68rem] text-muted-foreground">unidades</p>
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
                    </div>

                    {organization.allowed_actions.establishments.read &&
                      organization.establishments.length > 0 && (
                        <div className="border-t border-border/70 bg-muted/20 px-5 py-4 sm:px-6">
                          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Unidades recentes
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
                                    {establishment.public_name || `Unidade ${establishment.id}`}
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
