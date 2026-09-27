import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, Ban, Check, History, Info, MapPin, MessageSquareWarning } from 'lucide-react'
import type { ReactNode } from 'react'

import { ReasonDecision } from '~/components/backoffice/reason_decision'
import { PageHeader } from '~/components/page_header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import { formatCnpj, formatPhoneBR } from '~/lib/br_format'
import {
  formatDateTime,
  getRevisionStatusMeta,
  organizationRoleLabel,
  organizationStatusLabel,
} from '~/lib/labels'
import {
  organizationHistoryLabel,
  organizationStatusVariant,
  type OrganizationStatus,
} from '~/lib/organization_review'
import { cn } from '~/lib/utils'

type Person = { id: number; full_name: string; email: string }

interface OrganizationReviewProps {
  organization: {
    id: number
    legal_name: string
    trade_name: string
    slug: string
    tax_id: string
    email: string
    phone: string
    website: string | null
    status: OrganizationStatus
    created_at: string | null
    submitted_at: string | null
    reviewed_at: string | null
    review_notes: string | null
    reviewed_by: string | null
  }
  submitted_by: Person | null
  created_by: Person | null
  members: Array<{
    id: number
    full_name: string
    email: string
    role: string
    status: 'active' | 'suspended' | 'removed'
  }>
  establishments: Array<{
    id: number
    public_name: string | null
    city_name: string | null
    revision_status: string | null
    published: boolean
  }>
  history: Array<{
    id: number
    action: string
    status: OrganizationStatus | null
    reason: string | null
    actor: string | null
    at: string | null
  }>
  decisions: { approve: boolean; request_changes: boolean; reject: boolean }
}

const QUEUE_PATH = '/backoffice/organizations'

const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  suspended: 'Suspenso',
  removed: 'Removido',
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-[0.9375rem] font-medium">{children}</dd>
    </div>
  )
}

function Card({
  title,
  id,
  children,
  className,
}: {
  title: string
  id: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn('rounded-card border border-border-subtle bg-card p-5 sm:p-6', className)}
    >
      <h2 id={id} className="font-display text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function OrganizationReviewPage({
  organization,
  submitted_by: submittedBy,
  created_by: createdBy,
  members,
  establishments,
  history,
  decisions,
}: OrganizationReviewProps) {
  const submittedAt = formatDateTime(organization.submitted_at)
  const reviewedAt = formatDateTime(organization.reviewed_at)
  const canDecide = decisions.approve || decisions.request_changes || decisions.reject
  const inReview = organization.status === 'pending_review'

  return (
    <MainLayout>
      <Head title={`Analisar ${organization.trade_name}`} />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Caixa de moderação · organização"
          title={organization.trade_name}
          description={
            submittedAt
              ? `${organization.legal_name} · enviada em ${submittedAt}`
              : organization.legal_name
          }
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
              {canDecide ? (
                <Button asChild variant="primary" size="xl" shape="pill" className="sm:order-last">
                  <a href="#decisao">Decidir</a>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="lg" shape="pill">
                <Link href={QUEUE_PATH}>
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Voltar à fila
                </Link>
              </Button>
            </>
          }
        />

        {!inReview ? (
          <section
            aria-labelledby="fora-de-analise"
            className="flex items-start gap-3 rounded-card border border-info/25 bg-info-soft p-5"
          >
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info-accent" />
            <div className="min-w-0">
              <h2 id="fora-de-analise" className="font-display text-lg font-bold">
                Esta organização não está em análise
              </h2>
              <p className="mt-1 text-sm leading-6">
                {organization.reviewed_by && reviewedAt
                  ? `Última decisão: ${organizationStatusLabel(organization.status)}, por ${organization.reviewed_by} em ${reviewedAt}.`
                  : `Situação atual: ${organizationStatusLabel(organization.status)}.`}
              </p>
              {organization.review_notes ? (
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  Motivo registrado: {organization.review_notes}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            <Card title="Dados enviados" id="dados-enviados">
              <p className="mt-1 text-sm text-muted-foreground">
                Confira a razão social e o CNPJ em uma fonte oficial (por exemplo, o comprovante de
                inscrição na Receita Federal) e se os contatos respondem.
              </p>
              <dl className="mt-3 divide-y divide-border-subtle">
                <Field label="Razão social">{organization.legal_name}</Field>
                <Field label="Nome fantasia">{organization.trade_name}</Field>
                <Field label="CNPJ">
                  <span className="tabular-nums">{formatCnpj(organization.tax_id)}</span>
                </Field>
                <Field label="E-mail">{organization.email}</Field>
                <Field label="Telefone">
                  <span className="tabular-nums">{formatPhoneBR(organization.phone)}</span>
                </Field>
                <Field label="Website">
                  {organization.website ? (
                    <a
                      href={organization.website}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {organization.website}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Não informado</span>
                  )}
                </Field>
                <Field label="Endereço da página">{organization.slug}</Field>
              </dl>
            </Card>

            <Card title="Quem enviou" id="quem-enviou">
              <dl className="mt-3 divide-y divide-border-subtle">
                <Field label="Enviada por">
                  {submittedBy ? (
                    <>
                      {submittedBy.full_name}
                      <span className="block text-sm text-muted-foreground">
                        {submittedBy.email}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Não registrado</span>
                  )}
                </Field>
                {createdBy && createdBy.id !== submittedBy?.id ? (
                  <Field label="Criada por">
                    {createdBy.full_name}
                    <span className="block text-sm text-muted-foreground">{createdBy.email}</span>
                  </Field>
                ) : null}
                <Field label="Equipe">
                  {members.length === 0 ? (
                    <span className="text-muted-foreground">Ninguém na equipe</span>
                  ) : (
                    <ul className="space-y-1.5">
                      {members.map((member) => (
                        <li key={member.id}>
                          {member.full_name}{' '}
                          <span className="text-sm text-muted-foreground">
                            · {organizationRoleLabel(member.role)}
                            {member.status !== 'active'
                              ? ` · ${MEMBER_STATUS_LABELS[member.status] ?? member.status}`
                              : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Field>
              </dl>
            </Card>

            <Card title="Lugares cadastrados" id="lugares">
              <p className="mt-1 text-sm text-muted-foreground">
                Os dados de cada lugar passam por uma revisão própria, em Dados de lugares, depois
                que a organização for aprovada.
              </p>
              {establishments.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nenhum lugar cadastrado ainda.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border-subtle">
                  {establishments.map((place) => {
                    const meta = place.published
                      ? getRevisionStatusMeta('published')
                      : place.revision_status
                        ? getRevisionStatusMeta(place.revision_status)
                        : null
                    return (
                      <li
                        key={place.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <span className="flex min-w-0 items-center gap-2 font-medium">
                          <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />
                          <span className="truncate">
                            {place.public_name ?? `Lugar ${place.id}`}
                          </span>
                          {place.city_name ? (
                            <span className="text-sm text-muted-foreground">
                              · {place.city_name}
                            </span>
                          ) : null}
                        </span>
                        {meta ? (
                          <span
                            className={cn(
                              'inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-bold',
                              meta.className
                            )}
                          >
                            {meta.label}
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24" aria-label="Histórico da organização">
            <section className="rounded-card border border-border-subtle bg-card p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <History aria-hidden="true" className="size-5 text-primary" />
                Histórico
              </h2>
              {history.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nada registrado ainda.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {history.map((entry) => {
                    const at = formatDateTime(entry.at)
                    return (
                      <li key={entry.id} className="text-sm">
                        <p className="font-semibold">{organizationHistoryLabel(entry.action)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[entry.actor, at].filter(Boolean).join(' · ')}
                        </p>
                        {entry.reason ? (
                          <p className="mt-1 whitespace-pre-line text-xs">{entry.reason}</p>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </aside>
        </div>

        {canDecide ? (
          <section
            id="decisao"
            aria-labelledby="decisao-titulo"
            className="scroll-mt-24 space-y-4 rounded-card border border-border-subtle bg-card p-5 sm:p-6"
          >
            <div>
              <h2 id="decisao-titulo" className="font-display text-2xl font-extrabold">
                Decisão
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Aprovar deixa a organização Ativa, e os lugares dela podem ir para a moderação.
                Pedir correções devolve ao negócio, que lê o motivo no Portal e envia de novo.
                Rejeitar encerra o cadastro.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {decisions.approve ? (
                <ReasonDecision
                  action={`${QUEUE_PATH}/${organization.id}/approve`}
                  label="Aprovar organização"
                  icon={Check}
                  variant="primary"
                  title="Aprovar esta organização?"
                  description="A organização fica Ativa. O negócio pode então enviar os lugares para a moderação."
                  reasonLabel="Observação para o histórico"
                  reasonHint="Conte o que você conferiu. Fica no histórico da operação."
                  defaultReason="Razão social, CNPJ e contatos conferidos."
                  confirmLabel="Aprovar organização"
                />
              ) : null}
              {decisions.request_changes ? (
                <ReasonDecision
                  action={`${QUEUE_PATH}/${organization.id}/request-changes`}
                  label="Pedir correções"
                  icon={MessageSquareWarning}
                  title="Pedir correções ao negócio?"
                  description="A organização volta para o negócio como Correções solicitadas. Ele lê o motivo no Portal, ajusta os dados e envia de novo."
                  reasonLabel="O que o negócio precisa corrigir"
                  reasonHint="O negócio lê este texto no Portal. Seja específico."
                  placeholder="Ex.: o CNPJ informado pertence a outra empresa; confira o número no comprovante da Receita Federal."
                  confirmLabel="Pedir correções"
                />
              ) : null}
              {decisions.reject ? (
                <ReasonDecision
                  action={`${QUEUE_PATH}/${organization.id}/reject`}
                  label="Rejeitar"
                  icon={Ban}
                  variant="destructive"
                  className="sm:ml-auto"
                  title="Rejeitar esta organização?"
                  description="A rejeição encerra o cadastro: a organização não pode ser enviada de novo. Para um ajuste, peça correções."
                  reasonLabel="Motivo da rejeição"
                  reasonHint="O negócio lê este texto no Portal."
                  confirmLabel="Rejeitar organização"
                  destructive
                />
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </MainLayout>
  )
}
