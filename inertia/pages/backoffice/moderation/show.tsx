import { Head, Link, usePage } from '@inertiajs/react'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'

import { ModerationActions } from '~/components/backoffice/moderation_actions'
import { MainLayout } from '~/layouts/main_layout'
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

  return (
    <MainLayout>
      <Head title={`Moderar ${text(revision, 'public_name', 'revisão')}`} />

      <div className="space-y-8">
        <Link
          href="/backoffice/moderation"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar à fila
        </Link>

        <header>
          <p className="text-sm font-semibold text-primary">Revisão #{revisionId}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{publicName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>versão {numeric(revision, 'version')}</span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                statusMeta.className
              )}
            >
              {statusMeta.label}
            </span>
            <span className="text-sm">
              {submittedAt ? `Submetida em ${submittedAt}` : 'Data de submissão indisponível'}
            </span>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="space-y-5 rounded-3xl border border-border bg-card p-6">
            <div>
              <h2 className="text-xl font-semibold">Conteúdo submetido</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A publicação trocará o ponteiro público apenas depois de todos os gates passarem.
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Slug', text(revision, 'slug', '—')],
                ['Cidade', text(record(revision.city), 'name', '—')],
                ['Descrição curta', text(revision, 'short_description', '—')],
                [
                  'Disponibilidade',
                  availabilityType ? availabilityTypeLabel(availabilityType) : '—',
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-muted/60 p-4">
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
                        className="overflow-hidden rounded-2xl border border-border"
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

          <article className="space-y-5 rounded-3xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              {blockingIssues.length === 0 ? (
                <CheckCircle2 className="mt-0.5 size-6 text-primary" />
              ) : (
                <XCircle className="mt-0.5 size-6 text-destructive" />
              )}
              <div>
                <h2 className="text-xl font-semibold">PublicationGate</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {blockingIssues.length === 0
                    ? 'A revisão pode ser publicada.'
                    : `${blockingIssues.length} bloqueio(s) impedem a aprovação.`}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {[...blockingIssues, ...warnings].map((issue) => (
                <div
                  key={`${text(issue, 'code')}-${text(issue, 'field')}`}
                  className="rounded-xl bg-muted/60 p-3"
                >
                  <p className="text-sm font-medium">{text(issue, 'message')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text(issue, 'field', '—')} ·{' '}
                    {reviewIssueSeverityLabel(text(issue, 'severity', 'blocking'))}
                  </p>
                </div>
              ))}
              {blockingIssues.length === 0 && warnings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma pendência encontrada.</p>
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
            <article className="rounded-3xl border border-border bg-card p-6">
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
                    <div key={numeric(issue, 'id')} className="rounded-xl bg-muted/60 p-3 text-sm">
                      <p className="font-medium">{text(issue, 'message')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {text(issue, 'field', '—')} ·{' '}
                        {reviewIssueSeverityLabel(text(issue, 'severity'))}
                        {createdAt ? ` · registrada em ${createdAt}` : ''}
                        {resolvedAt ? ` · resolvida em ${resolvedAt}` : ' · em aberto'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </article>
            <article className="rounded-3xl border border-border bg-card p-6">
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
