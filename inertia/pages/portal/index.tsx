import { Head, Link } from '@inertiajs/react'
import { ArrowRight, Building2, CheckCircle2, CircleDashed, MapPin, Plus } from 'lucide-react'

import PilotFeedbackForm from '~/components/portal/pilot_feedback_form'
import { MainLayout } from '~/layouts/main_layout'

interface Completeness {
  score: number
  eligible: boolean
}

interface EstablishmentSummary {
  id: number
  public_name: string
  slug: string | null
  city_slug: string | null
  published_revision_id: number | null
  lifecycle_status: string
  business_status: string
  revision_status: string | null
  completeness: Completeness | null
}

interface OnboardingStep {
  key: string
  label: string
  completed: boolean
  href: string
}

interface OrganizationSummary {
  id: number
  legal_name: string
  trade_name: string
  status: string
  role: string | null
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    pending_review: 'Em análise',
    changes_requested: 'Correções solicitadas',
    active: 'Ativa',
    suspended: 'Suspensa',
    rejected: 'Rejeitada',
    archived: 'Arquivada',
  }

  return labels[status] ?? status
}

export default function PartnerPortalIndex({ overview, feedback_targets }: PortalIndexProps) {
  const stats = [
    ['Organizações', overview.totals.organizations],
    ['Unidades', overview.totals.establishments],
    ['Publicadas', overview.totals.published],
    ['Em análise', overview.totals.pending_review],
  ] as const

  return (
    <MainLayout>
      <Head title="Portal do parceiro" />

      <div className="space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Operação do parceiro</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Portal do parceiro</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Organize empresas e unidades, acompanhe a completude das fichas e envie conteúdo para
              moderação.
            </p>
          </div>
          <Link
            href="/portal/organizations/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" />
            Nova organização
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
            </article>
          ))}
        </section>

        {overview.organizations.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <Building2 className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">Comece pela organização</h2>
            <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
              Cadastre a identidade legal da empresa. Depois você poderá criar uma ou várias
              unidades em cidades diferentes.
            </p>
            <Link
              href="/portal/organizations/new"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Criar organização <ArrowRight className="size-4" />
            </Link>
          </section>
        ) : (
          <section className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Suas organizações</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O acesso é determinado pela sua membership em cada organização.
              </p>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
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
                    className="rounded-3xl border border-border bg-card p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold">{organization.trade_name}</h3>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                            {statusLabel(organization.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {organization.legal_name} · papel {organization.role}
                        </p>
                      </div>
                      <Link
                        href={`/portal/organizations/${organization.id}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                      >
                        Abrir <ArrowRight className="size-4" />
                      </Link>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-2xl bg-muted/60 p-3">
                        <p className="text-xl font-bold">{organization.totals.establishments}</p>
                        <p className="text-xs text-muted-foreground">unidades</p>
                      </div>
                      <div className="rounded-2xl bg-muted/60 p-3">
                        <p className="text-xl font-bold">{organization.totals.complete}</p>
                        <p className="text-xs text-muted-foreground">completas</p>
                      </div>
                      <div className="rounded-2xl bg-muted/60 p-3">
                        <p className="text-xl font-bold">{organization.totals.published}</p>
                        <p className="text-xs text-muted-foreground">publicadas</p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Onboarding</span>
                        <span className="text-muted-foreground">{progress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {organization.onboarding.map((step) => (
                          <Link
                            key={step.key}
                            href={step.href}
                            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition hover:bg-muted"
                          >
                            {step.completed ? (
                              <CheckCircle2 className="size-4 text-primary" />
                            ) : (
                              <CircleDashed className="size-4 text-muted-foreground" />
                            )}
                            {step.label}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {organization.establishments.length > 0 ? (
                      <div className="mt-6 space-y-2 border-t border-border pt-5">
                        {organization.establishments.slice(0, 3).map((establishment) => (
                          <Link
                            key={establishment.id}
                            href={`/portal/establishments/${establishment.id}`}
                            className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition hover:bg-muted"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <MapPin className="size-4 shrink-0 text-muted-foreground" />
                              <span className="truncate text-sm font-medium">
                                {establishment.public_name}
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {establishment.completeness?.score ?? 0}%
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        <PilotFeedbackForm targets={feedback_targets} context="onboarding" />
      </div>
    </MainLayout>
  )
}
