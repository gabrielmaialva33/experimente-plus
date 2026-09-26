import { Head, Link, usePage } from '@inertiajs/react'
import { ArrowLeft, CheckCircle2, ChevronDown, XCircle } from 'lucide-react'
import { useState } from 'react'

import { ModerationActions } from '~/components/backoffice/moderation_actions'
import { PageHeader } from '~/components/page_header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import { MODERATION_ISSUE_FIELD_GROUPS } from '~/lib/establishment_editor'
import { firstError } from '~/lib/form_errors'
import { collection, numeric, record, text, type JsonRecord } from '~/lib/json'
import {
  formatDateTime,
  getRevisionStatusMeta,
  mediaModerationStatusLabel,
  reviewIssueSeverityLabel,
  revisionEventTypeLabel,
  revisionStatusLabel,
} from '~/lib/labels'
import {
  changedCount,
  compareRevision,
  type ComparedSection,
  type ComparisonProps,
} from '~/lib/moderation_comparison'
import { cn } from '~/lib/utils'

type ModerationShowProps = {
  revision: JsonRecord
  comparison?: ComparisonProps | null
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
  return moderationFieldLabels.get(field) ?? 'Dados do lugar como um todo'
}

function SectionCard({
  section,
  onlyChanged,
  media,
  publicName,
}: {
  section: ComparedSection
  onlyChanged: boolean
  media: JsonRecord[]
  publicName: string
}) {
  const fields = onlyChanged ? section.fields.filter((field) => field.changed) : section.fields
  if (onlyChanged && fields.length === 0) return null

  return (
    <section
      aria-labelledby={`secao-${section.id}`}
      className="rounded-card border border-border-subtle bg-card p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={`secao-${section.id}`} className="font-display text-lg font-bold">
          {section.title}
        </h3>
        {section.changed > 0 ? (
          <Badge variant="warning" appearance="light" shape="pill" size="lg">
            {section.changed === 1 ? '1 alterado' : `${section.changed} alterados`}
          </Badge>
        ) : null}
      </div>
      <dl className="mt-4 divide-y divide-border-subtle">
        {fields.map((field) => (
          <div
            key={field.key}
            data-changed={field.changed ? 'true' : undefined}
            className={cn(
              'grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4',
              field.changed && '-mx-3 rounded-xl bg-warning-soft px-3'
            )}
          >
            <dt className="text-sm font-semibold text-muted-foreground">
              {field.label}
              {field.changed ? <span className="sr-only"> (alterado)</span> : null}
            </dt>
            <dd className="min-w-0 space-y-1 text-[0.9375rem]">
              <p className="whitespace-pre-line break-words font-medium">
                {field.value ?? <span className="text-muted-foreground">Não informado</span>}
              </p>
              {field.changed ? (
                <p className="text-sm text-warning-accent">
                  Antes: {field.before ?? 'não informado'}
                </p>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      {section.id === 'media' && media.length > 0 ? (
        <ul aria-label="Imagens enviadas" className="mt-4 grid gap-3 sm:grid-cols-2">
          {media.map((item) => {
            const url = text(item, 'url')
            const altText =
              text(item, 'alt_text') || text(item, 'caption') || `Imagem enviada para ${publicName}`
            return (
              <li
                key={numeric(item, 'id')}
                className="overflow-hidden rounded-2xl border border-border-subtle"
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
                <div className="flex justify-between gap-2 p-3 text-xs font-semibold">
                  <span>{mediaModerationStatusLabel(text(item, 'moderation_status'))}</span>
                  <span className="text-muted-foreground">
                    {item.is_cover === true ? 'Capa' : 'Galeria'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

export default function ModerationRevisionPage({
  revision,
  comparison,
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
  const publicName = text(revision, 'public_name', 'Lugar sem nome')
  const statusMeta = getRevisionStatusMeta(text(revision, 'status'))
  const submittedAt = formatDateTime(text(revision, 'submitted_at') || null)

  const sections = comparison ? compareRevision(comparison) : []
  const changes = changedCount(sections)
  const firstPublication = comparison ? comparison.published === null : false
  const [onlyChanged, setOnlyChanged] = useState(false)

  return (
    <MainLayout>
      <Head title={`Revisar ${publicName}`} />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Caixa de moderação · dados do lugar"
          title={publicName}
          description={
            submittedAt
              ? `Versão ${numeric(revision, 'version')} enviada em ${submittedAt}`
              : `Versão ${numeric(revision, 'version')}`
          }
          meta={
            <>
              <Badge
                variant="neutral"
                appearance="light"
                shape="pill"
                size="lg"
                className={statusMeta.className}
              >
                {statusMeta.label}
              </Badge>
              {comparison ? (
                firstPublication ? (
                  <Badge variant="info" appearance="light" shape="pill" size="lg">
                    Primeira publicação
                  </Badge>
                ) : (
                  <Badge
                    variant={changes > 0 ? 'warning' : 'success'}
                    appearance="light"
                    shape="pill"
                    size="lg"
                  >
                    {changes === 0
                      ? 'Sem alterações desde a versão publicada'
                      : changes === 1
                        ? '1 campo alterado'
                        : `${changes} campos alterados`}
                  </Badge>
                )
              ) : null}
            </>
          }
          actions={
            <>
              <Button asChild variant="cta" size="xl" shape="pill" className="sm:order-last">
                <a href="#decisao">Decidir</a>
              </Button>
              <Button asChild variant="outline" size="lg" shape="pill">
                <Link href="/backoffice/moderation">
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Voltar à caixa
                </Link>
              </Button>
            </>
          }
        />

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-5">
            {comparison ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-extrabold">
                  {firstPublication
                    ? 'Tudo o que aparecerá na página'
                    : `Comparado à versão publicada ${comparison.published_version ?? ''}`.trim()}
                </h2>
                {!firstPublication && changes > 0 ? (
                  <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={onlyChanged}
                      onChange={(event) => setOnlyChanged(event.target.checked)}
                      className="size-5 accent-primary"
                    />
                    Mostrar só o que mudou
                  </label>
                ) : null}
              </div>
            ) : null}
            {sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                onlyChanged={onlyChanged}
                media={media}
                publicName={publicName}
              />
            ))}
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24" aria-label="Situação da revisão">
            <section className="rounded-card border border-border-subtle bg-card p-5">
              <div className="flex items-start gap-3">
                {blockingIssues.length === 0 ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-6 shrink-0 text-success"
                  />
                ) : (
                  <XCircle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-destructive" />
                )}
                <div>
                  <h2 className="font-display text-lg font-bold">Pendências para publicação</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {blockingIssues.length === 0
                      ? 'A revisão pode ser publicada.'
                      : blockingIssues.length === 1
                        ? '1 pendência impede a aprovação.'
                        : `${blockingIssues.length} pendências impedem a aprovação.`}
                  </p>
                </div>
              </div>
              {blockingIssues.length + warnings.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {[...blockingIssues, ...warnings].map((issue) => (
                    <li
                      key={`${text(issue, 'code')}-${text(issue, 'field')}`}
                      className="rounded-xl bg-muted p-3"
                    >
                      <p className="text-sm font-semibold">{text(issue, 'message')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {moderationFieldLabel(text(issue, 'field'))} ·{' '}
                        {reviewIssueSeverityLabel(text(issue, 'severity', 'blocking'))}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Os critérios automáticos de publicação foram atendidos.
                </p>
              )}
            </section>

            {revisionEvents.length > 0 || existingIssues.length > 0 ? (
              <details className="group rounded-card border border-border-subtle bg-card p-5" open>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold">Histórico</h2>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <ol className="mt-3 space-y-3">
                  {revisionEvents.map((event) => {
                    const createdAt = formatDateTime(text(event, 'created_at') || null)
                    return (
                      <li key={`evento-${numeric(event, 'id')}`} className="text-sm">
                        <p className="font-semibold">
                          {revisionEventTypeLabel(text(event, 'event_type', '—'))}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {statusOrFallback(text(event, 'from_status'))} →{' '}
                          {statusOrFallback(text(event, 'to_status'))}
                          {createdAt ? ` · ${createdAt}` : ''}
                        </p>
                        {text(event, 'reason') ? (
                          <p className="mt-1 text-xs">{text(event, 'reason')}</p>
                        ) : null}
                      </li>
                    )
                  })}
                  {existingIssues.map((issue) => {
                    const resolvedAt = formatDateTime(text(issue, 'resolved_at') || null)
                    const createdAt = formatDateTime(text(issue, 'created_at') || null)
                    return (
                      <li key={`pendencia-${numeric(issue, 'id')}`} className="text-sm">
                        <p className="font-semibold">Correção pedida: {text(issue, 'message')}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {moderationFieldLabel(text(issue, 'field'))} ·{' '}
                          {reviewIssueSeverityLabel(text(issue, 'severity'))}
                          {createdAt ? ` · registrada em ${createdAt}` : ''}
                          {resolvedAt ? ` · resolvida em ${resolvedAt}` : ' · em aberto'}
                        </p>
                      </li>
                    )
                  })}
                </ol>
              </details>
            ) : null}
          </aside>
        </div>

        <section id="decisao" aria-labelledby="decisao-titulo" className="scroll-mt-24 space-y-4">
          <h2 id="decisao-titulo" className="font-display text-2xl font-extrabold">
            Decisão
          </h2>
          <ModerationActions
            revisionId={revisionId}
            blockingIssueCount={blockingIssues.length}
            moderationError={firstError(pageErrors?.moderation)}
          />
        </section>
      </div>
    </MainLayout>
  )
}
