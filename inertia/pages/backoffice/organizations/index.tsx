import { Head, Link } from '@inertiajs/react'
import { ArrowRight, Building2, Check, KeyRound, MapPin, X } from 'lucide-react'

import { ReasonDecision } from '~/components/backoffice/reason_decision'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import { formatCnpj } from '~/lib/br_format'
import { formatDateTime, organizationStatusLabel } from '~/lib/labels'
import {
  organizationStatusFilterLabel,
  organizationStatusVariant,
  type OrganizationStatus,
} from '~/lib/organization_review'
import { cn } from '~/lib/utils'

type Person = { id: number; full_name: string; email: string }

interface QueueRow {
  id: number
  trade_name: string
  legal_name: string
  tax_id: string
  status: OrganizationStatus
  submitted_at: string | null
  submitted_by: Person | null
  establishments: number
}

interface ClaimRow {
  id: number
  created_at: string | null
  message: string | null
  evidence_description: string | null
  document_count: number
  claimant: Person | null
  organization: {
    id: number
    trade_name: string
    legal_name: string
    tax_id: string
    status: OrganizationStatus
  } | null
}

interface OrganizationQueueProps {
  status: OrganizationStatus
  counts: Record<OrganizationStatus, number>
  organizations: QueueRow[]
  claims: ClaimRow[]
  claim_decisions: { approve: boolean; reject: boolean }
}

const QUEUE_PATH = '/backoffice/organizations'

/** The queue first; the other states only when they have something to show. */
const FILTER_ORDER: OrganizationStatus[] = [
  'pending_review',
  'changes_requested',
  'draft',
  'active',
  'rejected',
  'suspended',
  'archived',
]

const EMPTY_COPY: Partial<Record<OrganizationStatus, { title: string; description: string }>> = {
  pending_review: {
    title: 'Nenhuma organização esperando',
    description:
      'Quando um negócio tocar em Enviar para análise, no Portal, a organização aparece aqui.',
  },
}

function places(count: number) {
  if (count === 0) return 'Nenhum lugar cadastrado'
  return count === 1 ? '1 lugar' : `${count} lugares`
}

export default function OrganizationQueuePage({
  status,
  counts,
  organizations,
  claims,
  claim_decisions: claimDecisions,
}: OrganizationQueueProps) {
  const waiting = counts.pending_review ?? 0
  const filters = FILTER_ORDER.filter(
    (value) => value === 'pending_review' || value === status || (counts[value] ?? 0) > 0
  )
  const empty = EMPTY_COPY[status] ?? {
    title: `Nenhuma organização em “${organizationStatusFilterLabel(status)}”`,
    description: 'Nenhuma organização da operação está neste estado.',
  }

  return (
    <MainLayout>
      <Head title="Organizações" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Caixa de moderação"
          icon={Building2}
          title="Organizações"
          description="Negócios que se cadastraram no Portal e esperam a conferência da operação. Enquanto a organização está em análise, os lugares dela ficam parados."
          meta={
            <Badge
              variant={waiting === 0 ? 'neutral' : 'warning'}
              appearance="light"
              shape="pill"
              size="lg"
            >
              {waiting === 0
                ? 'Nada esperando'
                : waiting === 1
                  ? '1 organização esperando'
                  : `${waiting.toLocaleString('pt-BR')} organizações esperando`}
            </Badge>
          }
        />

        <nav aria-label="Estado das organizações" className="flex flex-wrap gap-2">
          {filters.map((value) => {
            const selected = value === status
            return (
              <Link
                key={value}
                href={value === 'pending_review' ? QUEUE_PATH : `${QUEUE_PATH}?status=${value}`}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent'
                )}
              >
                {organizationStatusFilterLabel(value)}
                <span
                  className={cn(
                    'inline-flex min-w-6 justify-center rounded-full px-1.5 text-xs font-bold tabular-nums',
                    selected ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {(counts[value] ?? 0).toLocaleString('pt-BR')}
                </span>
              </Link>
            )
          })}
        </nav>

        {organizations.length === 0 ? (
          <EmptyState
            icon={Building2}
            headingLevel={2}
            title={empty.title}
            description={empty.description}
            className="rounded-card border border-dashed border-border bg-card"
          />
        ) : (
          <section aria-label="Organizações" className="space-y-3">
            {organizations.map((organization) => {
              const submittedAt = formatDateTime(organization.submitted_at)
              return (
                <article
                  key={organization.id}
                  className="flex flex-col gap-4 rounded-card border border-border-subtle bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent sm:flex">
                      <Building2 aria-hidden="true" className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-lg font-bold">
                          {organization.trade_name}
                        </h2>
                        <Badge
                          variant={organizationStatusVariant(organization.status)}
                          appearance="light"
                          shape="pill"
                          size="md"
                        >
                          {organizationStatusLabel(organization.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {organization.legal_name} ·{' '}
                        <span className="tabular-nums">CNPJ {formatCnpj(organization.tax_id)}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {organization.submitted_by
                          ? `Enviada por ${organization.submitted_by.full_name}`
                          : 'Quem enviou não foi registrado'}
                        {submittedAt ? ` em ${submittedAt}` : ''}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                        <MapPin aria-hidden="true" className="size-4 text-primary" />
                        {places(organization.establishments)}
                      </p>
                    </div>
                  </div>

                  <Button
                    asChild
                    variant={organization.status === 'pending_review' ? 'primary' : 'outline'}
                    size="lg"
                    shape="pill"
                    className="shrink-0"
                  >
                    <Link href={`${QUEUE_PATH}/${organization.id}`}>
                      {organization.status === 'pending_review' ? 'Analisar' : 'Ver dados'}
                      <span className="sr-only">: {organization.trade_name}</span>
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </Button>
                </article>
              )
            })}
          </section>
        )}

        <section aria-labelledby="claims-title" className="space-y-3">
          <div>
            <h2
              id="claims-title"
              className="font-display text-xl font-extrabold tracking-[-0.01em]"
            >
              Reivindicações
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pedidos para administrar uma organização que está sem proprietário. Aprovar torna a
              pessoa proprietária da organização.
            </p>
          </div>

          {claims.length === 0 ? (
            <p className="rounded-card border border-dashed border-border bg-card px-5 py-4 text-sm text-muted-foreground">
              Nenhuma reivindicação esperando.
            </p>
          ) : (
            claims.map((claim) => {
              const receivedAt = formatDateTime(claim.created_at)
              const name = claim.organization?.trade_name ?? 'Organização'
              return (
                <article
                  key={claim.id}
                  aria-labelledby={`claim-${claim.id}`}
                  className="overflow-hidden rounded-card border border-border-subtle bg-card"
                >
                  <div className="space-y-2 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <KeyRound aria-hidden="true" className="size-4 text-primary" />
                      <h3 id={`claim-${claim.id}`} className="font-display text-lg font-bold">
                        {name}
                      </h3>
                      {claim.organization ? (
                        <span className="text-sm tabular-nums text-muted-foreground">
                          CNPJ {formatCnpj(claim.organization.tax_id)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm">
                      <span className="font-semibold">{claim.claimant?.full_name ?? 'Pessoa'}</span>
                      {claim.claimant ? (
                        <span className="text-muted-foreground"> · {claim.claimant.email}</span>
                      ) : null}
                      {receivedAt ? (
                        <span className="text-muted-foreground"> · pediu em {receivedAt}</span>
                      ) : null}
                    </p>
                    {claim.message ? (
                      <p className="whitespace-pre-line text-sm leading-6">{claim.message}</p>
                    ) : null}
                    {claim.evidence_description ? (
                      <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                        Comprovação: {claim.evidence_description}
                      </p>
                    ) : null}
                    {claim.document_count > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {claim.document_count === 1
                          ? '1 documento anexado'
                          : `${claim.document_count} documentos anexados`}
                      </p>
                    ) : null}
                  </div>

                  {claimDecisions.approve || claimDecisions.reject ? (
                    <div
                      role="group"
                      aria-label={`Decisão sobre a reivindicação de ${name}`}
                      className="flex flex-wrap justify-end gap-2 border-t border-border-subtle bg-muted/40 px-5 py-4"
                    >
                      {claimDecisions.reject ? (
                        <ReasonDecision
                          action={`/backoffice/organization-claims/${claim.id}/reject`}
                          label="Recusar"
                          icon={X}
                          title="Recusar esta reivindicação?"
                          description="A pessoa não ganha acesso à organização. O motivo fica registrado no histórico."
                          reasonLabel="Motivo da recusa"
                          reasonHint="Fica no histórico da operação."
                          confirmLabel="Recusar reivindicação"
                          destructive
                        />
                      ) : null}
                      {claimDecisions.approve ? (
                        <ReasonDecision
                          action={`/backoffice/organization-claims/${claim.id}/approve`}
                          label="Aprovar"
                          icon={Check}
                          variant="primary"
                          title="Aprovar esta reivindicação?"
                          description="A pessoa passa a ser proprietária da organização, com acesso a todos os lugares dela. Outras reivindicações da mesma organização são recusadas."
                          reasonLabel="Observação para o histórico"
                          reasonHint="Conte o que você conferiu. Fica no histórico da operação."
                          defaultReason="Vínculo com a organização conferido."
                          confirmLabel="Aprovar reivindicação"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </article>
              )
            })
          )}
        </section>
      </div>
    </MainLayout>
  )
}
