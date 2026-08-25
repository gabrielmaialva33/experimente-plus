import { Head, Link, router, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Building2, MapPin, Plus } from 'lucide-react'

import PilotFeedbackForm from '~/components/portal/pilot_feedback_form'
import { MainLayout } from '~/layouts/main_layout'

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

const editableStatuses = new Set(['draft', 'changes_requested'])

export default function PortalOrganizationPage({
  organization,
  feedback_targets,
}: OrganizationPageProps) {
  const form = useForm<OrganizationFormData>({
    legal_name: organization.legal_name,
    trade_name: organization.trade_name,
    slug: organization.slug,
    tax_id: organization.tax_id,
    email: organization.email,
    phone: organization.phone,
    website: organization.website ?? '',
  })
  const editable = editableStatuses.has(organization.status)

  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.put(`/portal/organizations/${organization.id}`, { preserveScroll: true })
  }

  function submitForReview() {
    router.post(`/portal/organizations/${organization.id}/submit`, {}, { preserveScroll: true })
  }

  return (
    <MainLayout>
      <Head title={organization.trade_name} />

      <div className="space-y-8">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar ao portal
        </Link>

        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Organização · {organization.role}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{organization.trade_name}</h1>
            <p className="mt-2 text-muted-foreground">
              {organization.legal_name} · status {organization.status}
            </p>
          </div>
          <Link
            href={`/portal/organizations/${organization.id}/establishments/new`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Nova unidade
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={update}
            className="space-y-5 rounded-3xl border border-border bg-card p-6"
          >
            <div>
              <h2 className="text-xl font-semibold">Dados da organização</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Dados legais ficam privados e são revisados pela equipe da plataforma.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['legal_name', 'Razão social'],
                  ['trade_name', 'Nome fantasia'],
                  ['slug', 'Slug'],
                  ['tax_id', 'CNPJ'],
                  ['email', 'E-mail'],
                  ['phone', 'Telefone'],
                ] as const
              ).map(([name, label]) => (
                <label key={name} className="space-y-2 text-sm">
                  <span className="font-medium">{label}</span>
                  <input
                    disabled={!editable}
                    value={form.data[name]}
                    onChange={(event) => form.setData(name, event.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
                  />
                  {form.errors[name] ? (
                    <span className="text-xs text-destructive">{form.errors[name]}</span>
                  ) : null}
                </label>
              ))}
            </div>

            <label className="block space-y-2 text-sm">
              <span className="font-medium">Website</span>
              <input
                disabled={!editable}
                value={form.data.website}
                onChange={(event) => form.setData('website', event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60"
              />
            </label>

            {editable ? (
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="submit"
                  disabled={form.processing}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                >
                  Salvar dados
                </button>
                <button
                  type="button"
                  onClick={submitForReview}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Enviar organização para análise
                </button>
              </div>
            ) : null}
          </form>

          <PilotFeedbackForm
            targets={feedback_targets}
            context="organization"
            organizationId={organization.id}
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Unidades</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada endereço público possui ficha, mídia e publicação próprias.
              </p>
            </div>
          </div>

          {organization.establishments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-9 text-center">
              <Building2 className="mx-auto size-9 text-muted-foreground" />
              <p className="mt-3 font-semibold">Nenhuma unidade cadastrada</p>
              <Link
                href={`/portal/organizations/${organization.id}/establishments/new`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"
              >
                Criar primeira unidade <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {organization.establishments.map((establishment) => (
                <Link
                  key={establishment.id}
                  href={`/portal/establishments/${establishment.id}`}
                  className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 font-semibold">
                        <MapPin className="size-4 text-primary" /> {establishment.public_name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {establishment.published_revision ? 'Publicada' : 'Ainda não publicada'}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {establishment.completeness.score}%
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${establishment.completeness.score}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  )
}
