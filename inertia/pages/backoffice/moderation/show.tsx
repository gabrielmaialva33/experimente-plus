import { Head, Link, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, Plus, Trash2, XCircle } from 'lucide-react'

import { MainLayout } from '~/layouts/main_layout'

type JsonRecord = Record<string, unknown>

interface ModerationShowProps {
  revision: JsonRecord
}

interface ReviewIssueInput {
  code: string
  field: string
  message: string
  severity: 'blocking' | 'warning'
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function collection(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => record(item) !== null)
    : []
}

function text(source: JsonRecord | null, key: string, fallback = ''): string {
  const value = source?.[key]
  return typeof value === 'string' ? value : fallback
}

function numeric(source: JsonRecord | null, key: string): number {
  const value = source?.[key]
  return typeof value === 'number' ? value : Number(value ?? 0)
}

export default function ModerationRevisionPage({ revision }: ModerationShowProps) {
  const gate = record(revision.publication_gate)
  const blockingIssues = collection(gate?.blocking_issues)
  const warnings = collection(gate?.warnings)
  const media = collection(revision.media)
  const existingIssues = collection(revision.issues)
  const events = collection(revision.events)
  const revisionId = numeric(revision, 'id')

  const approveForm = useForm({ reason: '' })
  const rejectForm = useForm({ reason: '' })
  const changesForm = useForm<{ reason: string; issues: ReviewIssueInput[] }>({
    reason: '',
    issues: [
      {
        code: 'content_adjustment',
        field: 'revision',
        message: '',
        severity: 'blocking',
      },
    ],
  })

  function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    approveForm.post(`/backoffice/moderation/${revisionId}/approve`)
  }

  function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    rejectForm.post(`/backoffice/moderation/${revisionId}/reject`)
  }

  function requestChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    changesForm.post(`/backoffice/moderation/${revisionId}/request-changes`)
  }

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
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {text(revision, 'public_name', 'Unidade sem nome')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            versão {numeric(revision, 'version')} · status {text(revision, 'status')}
          </p>
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
                ['Disponibilidade', text(revision, 'availability_type', '—')],
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
                    const asset = record(item.asset)
                    const file = record(asset?.file)
                    const url = text(file, 'url') || text(asset, 'url')
                    return (
                      <article
                        key={numeric(item, 'id')}
                        className="overflow-hidden rounded-2xl border border-border"
                      >
                        {url ? (
                          <img
                            src={url}
                            alt={text(item, 'alt_text')}
                            className="aspect-video w-full object-cover"
                          />
                        ) : null}
                        <div className="flex justify-between gap-2 p-3 text-xs">
                          <span>{text(item, 'moderation_status')}</span>
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
                  <p className="mt-1 text-xs text-muted-foreground">{text(issue, 'field')}</p>
                </div>
              ))}
              {blockingIssues.length === 0 && warnings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma pendência encontrada.</p>
              ) : null}
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <form
            onSubmit={approve}
            className="space-y-4 rounded-3xl border border-border bg-card p-6"
          >
            <h2 className="text-lg font-semibold">Aprovar e publicar</h2>
            <textarea
              rows={4}
              maxLength={1000}
              value={approveForm.data.reason}
              onChange={(event) => approveForm.setData('reason', event.target.value)}
              placeholder="Observação opcional"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              disabled={approveForm.processing || blockingIssues.length > 0}
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Aprovar revisão
            </button>
          </form>

          <form
            onSubmit={requestChanges}
            className="space-y-4 rounded-3xl border border-border bg-card p-6 xl:col-span-2"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Solicitar correções</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pendências estruturadas permanecem no histórico após a ressubmissão.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  changesForm.setData('issues', [
                    ...changesForm.data.issues,
                    {
                      code: 'content_adjustment',
                      field: 'revision',
                      message: '',
                      severity: 'blocking',
                    },
                  ])
                }
                className="rounded-lg border border-border p-2"
                aria-label="Adicionar pendência"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <input
              required
              minLength={3}
              maxLength={1000}
              value={changesForm.data.reason}
              onChange={(event) => changesForm.setData('reason', event.target.value)}
              placeholder="Resumo da decisão"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />

            <div className="space-y-3">
              {changesForm.data.issues.map((issue, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-2xl bg-muted/60 p-4 md:grid-cols-[0.7fr_0.8fr_1.8fr_0.7fr_auto]"
                >
                  <input
                    required
                    value={issue.code}
                    onChange={(event) =>
                      changesForm.setData(
                        'issues',
                        changesForm.data.issues.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, code: event.target.value } : item
                        )
                      )
                    }
                    placeholder="code"
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    required
                    value={issue.field}
                    onChange={(event) =>
                      changesForm.setData(
                        'issues',
                        changesForm.data.issues.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, field: event.target.value } : item
                        )
                      )
                    }
                    placeholder="campo"
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    required
                    minLength={3}
                    value={issue.message}
                    onChange={(event) =>
                      changesForm.setData(
                        'issues',
                        changesForm.data.issues.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, message: event.target.value } : item
                        )
                      )
                    }
                    placeholder="Correção necessária"
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                  <select
                    value={issue.severity}
                    onChange={(event) =>
                      changesForm.setData(
                        'issues',
                        changesForm.data.issues.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                severity: event.target.value as ReviewIssueInput['severity'],
                              }
                            : item
                        )
                      )
                    }
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="blocking">Bloqueio</option>
                    <option value="warning">Aviso</option>
                  </select>
                  <button
                    type="button"
                    disabled={changesForm.data.issues.length === 1}
                    onClick={() =>
                      changesForm.setData(
                        'issues',
                        changesForm.data.issues.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    className="rounded-lg p-2 text-destructive disabled:opacity-30"
                    aria-label="Remover pendência"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            <button className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">
              Enviar correções
            </button>
          </form>
        </section>

        <form
          onSubmit={reject}
          className="space-y-4 rounded-3xl border border-destructive/30 bg-card p-6"
        >
          <div>
            <h2 className="text-lg font-semibold text-destructive">Rejeitar definitivamente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A revisão será terminal. Uma nova tentativa exigirá a clonagem de outra revisão.
            </p>
          </div>
          <textarea
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            value={rejectForm.data.reason}
            onChange={(event) => rejectForm.setData('reason', event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">
            Rejeitar revisão
          </button>
        </form>

        {existingIssues.length > 0 || events.length > 0 ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Pendências anteriores</h2>
              <div className="mt-4 space-y-3">
                {existingIssues.map((issue) => (
                  <div key={numeric(issue, 'id')} className="rounded-xl bg-muted/60 p-3 text-sm">
                    <p className="font-medium">{text(issue, 'message')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {text(issue, 'field')} · {text(issue, 'severity')}
                    </p>
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-3xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Histórico</h2>
              <div className="mt-4 space-y-3">
                {events.map((event) => (
                  <div
                    key={numeric(event, 'id')}
                    className="border-l-2 border-primary pl-3 text-sm"
                  >
                    <p className="font-medium">{text(event, 'event_type')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {text(event, 'from_status')} → {text(event, 'to_status')}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}
      </div>
    </MainLayout>
  )
}
