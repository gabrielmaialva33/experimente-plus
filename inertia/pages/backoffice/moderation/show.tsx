import { Head, Link, usePage } from '@inertiajs/react'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'

import { ModerationActions } from '~/components/backoffice/moderation_actions'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import { MODERATION_ISSUE_FIELD_GROUPS } from '~/lib/establishment_editor'
import { firstError } from '~/lib/form_errors'
import { collection, numeric, record, text, type JsonRecord } from '~/lib/json'
import {
  availabilityTypeLabel,
  formatDateTime,
  getRevisionStatusMeta,
  mediaModerationStatusLabel,
  reviewIssueSeverityLabel,
  revisionEventTypeLabel,
  revisionStatusLabel,
} from '~/lib/labels'
import { cn } from '~/lib/utils'

interface ModerationShowProps {
  revision: JsonRecord
  publication_gate: unknown
  review_issues: unknown
  events: unknown
}

function statusOrFallback(status: string): string {
  return status ? revisionStatusLabel(status) : '—'
}

const moderationFieldLabels = new Map(
  MODERATION_ISSUE_FIELD_GROUPS.flatMap((group) =>
    group.options.map((option) => [option.value, option.label] as const)
  )
)

function moderationFieldLabel(field: string): string {
  return moderationFieldLabels.get(field) ?? 'Conteúdo da ficha'
}

export default function ModerationRevisionPage({
  revision,
  publication_gate,
  review_issues,
  events,
}: ModerationShowProps) {
  const { errors: pageErrors } = usePage().props as { errors?: Record<string, unknown> }
  const gate = record(publication_gate)
  const blockingIssues = collection(gate?.blocking_issues)
  const warnings = collection(gate?.warnings)
  const media = collection(revision.media)
  const existingIssues = collection(review_issues)
  const revisionEvents = collection(events)
  const revisionId = numeric(revision, 'id')
  const publicName = text(revision, 'public_name', 'Unidade sem nome')
  const statusMeta = getRevisionStatusMeta(text(revision, 'status'))
  const submittedAt = formatDateTime(text(revision, 'submitted_at') || null)
  const availabilityType = text(revision, 'availability_type')
  const slug = text(revision, 'slug')

  return (
    <MainLayout>
      <Head title="Revisão de conteúdo" />

      <div className="space-y-8">
        <PageHeader
          eyebrow="Moderação"
          title="Revisão de conteúdo"
          description={
            submittedAt
              ? `${publicName} · submetida em ${submittedAt}`
              : `${publicName} · data de submissão indisponível`
          }
          meta={
            <>
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
                versão {numeric(revision, 'version')}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                  statusMeta.className
                )}
              >
                {statusMeta.label}
              </span>
            </>
          }
          actions={
            <Button asChild variant="outline">
              <Link href="/backoffice/moderation">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Voltar à fila
              </Link>
            </Button>
          }
        />

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold">Conteúdo submetido</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O conteúdo só ficará público depois que todos os critérios forem atendidos.
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Endereço da página', slug ? `/${slug}` : '—'],
                ['Cidade', text(record(revision.city), 'name', '—')],
                ['Descrição curta', text(revision, 'short_description', '—')],
                [
                  'Disponibilidade',
                  availabilityType ? availabilityTypeLabel(availabilityType) : '—',
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-muted/40 p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            {media.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold">Mídia</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {media.map((item) => {
                    const url = text(item, 'url')
                    const altText =
                      text(item, 'alt_text') ||
                      text(item, 'caption') ||
                      `Imagem enviada para ${publicName}`
                    return (
                      <article
                        key={numeric(item, 'id')}
                        className="overflow-hidden rounded-md border border-border"
                      >
                        {url ? (
                          <img
                            src={url}
                            alt={altText}
                            loading="lazy"
                            decoding="async"
                            className="aspect-video w-full bg-muted object-cover"
                          />
                        ) : (
                          <div className="flex aspect-video w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                            Pré-visualização indisponível
                          </div>
                        )}
                        <div className="flex justify-between gap-2 p-3 text-xs">
                          <span>{mediaModerationStatusLabel(text(item, 'moderation_status'))}</span>
                          <span>{item.is_cover === true ? 'Capa' : 'Galeria'}</span>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </article>

          <article className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              {blockingIssues.length === 0 ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 text-primary" />
              ) : (
                <XCircle aria-hidden="true" className="mt-0.5 size-6 text-destructive" />
              )}
              <div>
                <h2 className="text-xl font-semibold">Pendências para publicação</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {blockingIssues.length === 0
                    ? 'A revisão pode ser publicada.'
                    : blockingIssues.length === 1
                      ? '1 pendência impede a aprovação.'
                      : `${blockingIssues.length} pendências impedem a aprovação.`}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {[...blockingIssues, ...warnings].map((issue) => (
                <div
                  key={`${text(issue, 'code')}-${text(issue, 'field')}`}
                  className="rounded-md border border-border bg-muted/40 p-3"
                >
                  <p className="text-sm font-medium">{text(issue, 'message')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {moderationFieldLabel(text(issue, 'field'))} ·{' '}
                    {reviewIssueSeverityLabel(text(issue, 'severity', 'blocking'))}
                  </p>
                </div>
              ))}
              {blockingIssues.length === 0 && warnings.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  headingLevel={3}
                  title="Nenhuma pendência encontrada"
                  description="O conteúdo atende aos critérios automáticos de publicação."
                  className="py-6"
                />
              ) : null}
            </div>
          </article>
        </section>

        <ModerationActions
          revisionId={revisionId}
          blockingIssueCount={blockingIssues.length}
          moderationError={firstError(pageErrors?.moderation)}
        />

        {existingIssues.length > 0 || revisionEvents.length > 0 ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-lg border border-border bg-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Pendências anteriores</h2>
              <div className="mt-4 space-y-3">
                {existingIssues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma pendência registrada para esta revisão.
                  </p>
                ) : null}
                {existingIssues.map((issue) => {
                  const resolvedAt = formatDateTime(text(issue, 'resolved_at') || null)
                  const createdAt = formatDateTime(text(issue, 'created_at') || null)
                  return (
                    <div
                      key={numeric(issue, 'id')}
                      className="rounded-md border border-border bg-muted/40 p-3 text-sm"
                    >
                      <p className="font-medium">{text(issue, 'message')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {moderationFieldLabel(text(issue, 'field'))} ·{' '}
                        {reviewIssueSeverityLabel(text(issue, 'severity'))}
                        {createdAt ? ` · registrada em ${createdAt}` : ''}
                        {resolvedAt ? ` · resolvida em ${resolvedAt}` : ' · em aberto'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </article>
            <article className="rounded-lg border border-border bg-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Histórico</h2>
              <div className="mt-4 space-y-3">
                {revisionEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum evento registrado para esta revisão.
                  </p>
                ) : null}
                {revisionEvents.map((event) => {
                  const createdAt = formatDateTime(text(event, 'created_at') || null)
                  return (
                    <div
                      key={numeric(event, 'id')}
                      className="border-l-2 border-primary pl-3 text-sm"
                    >
                      <p className="font-medium">
                        {revisionEventTypeLabel(text(event, 'event_type', '—'))}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {statusOrFallback(text(event, 'from_status'))} →{' '}
                        {statusOrFallback(text(event, 'to_status'))}
                        {createdAt ? ` · ${createdAt}` : ''}
                      </p>
                      {text(event, 'reason') ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {text(event, 'reason')}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </article>
          </section>
        ) : null}
      </div>
    </MainLayout>
  )
}
