import { Head, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import { MessageSquareText, Star } from 'lucide-react'

import { MainLayout } from '~/layouts/main_layout'

type JsonRecord = Record<string, unknown>

interface FeedbackIndexProps {
  feedback: unknown
  filters: JsonRecord
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function collection(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonRecord => record(item) !== null)
  const source = record(value)
  const data = source?.data
  return Array.isArray(data) ? data.filter((item): item is JsonRecord => record(item) !== null) : []
}

function text(source: JsonRecord | null, key: string, fallback = ''): string {
  const value = source?.[key]
  return typeof value === 'string' ? value : fallback
}

function numeric(source: JsonRecord | null, key: string): number {
  const value = source?.[key]
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function FeedbackCard({ item }: { item: JsonRecord }) {
  const form = useForm({
    status: text(item, 'status', 'new'),
    internal_notes: text(item, 'internal_notes'),
  })
  const organization = record(item.organization)
  const establishment = record(item.establishment)
  const establishmentRevision = collection(establishment?.revisions)[0] ?? null
  const user = record(item.author) ?? record(item.user)
  const id = numeric(item, 'id')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.patch(`/backoffice/feedback/${id}`, { preserveScroll: true })
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {text(item, 'context')}
            </span>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {text(item, 'status')}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {text(user, 'full_name', 'Usuário do piloto')}
            {organization ? ` · ${text(organization, 'trade_name')}` : ''}
            {establishment
              ? ` · ${text(
                  establishmentRevision,
                  'public_name',
                  text(establishment, 'public_name', `Unidade ${numeric(establishment, 'id')}`)
                )}`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm font-semibold">
          <Star className="size-4 fill-current text-primary" /> {numeric(item, 'rating')}/5
        </div>
      </div>

      <p className="mt-5 whitespace-pre-wrap text-sm leading-6">{text(item, 'message')}</p>

      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 border-t border-border pt-5 md:grid-cols-[0.4fr_1fr_auto] md:items-end"
      >
        <label className="space-y-2 text-sm">
          <span className="font-medium">Status</span>
          <select
            value={form.data.status}
            onChange={(event) => form.setData('status', event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value="new">Novo</option>
            <option value="in_review">Em análise</option>
            <option value="resolved">Resolvido</option>
            <option value="dismissed">Descartado</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">Nota interna</span>
          <input
            value={form.data.internal_notes}
            onChange={(event) => form.setData('internal_notes', event.target.value)}
            maxLength={4000}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <button
          disabled={form.processing}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Atualizar
        </button>
      </form>
    </article>
  )
}

export default function PilotFeedbackBackofficePage({ feedback }: FeedbackIndexProps) {
  const items = collection(feedback)
  const meta = record(record(feedback)?.meta)

  return (
    <MainLayout>
      <Head title="Feedback do piloto" />

      <div className="space-y-7">
        <header>
          <p className="text-sm font-semibold text-primary">Backoffice</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Feedback do piloto</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Relatos estruturados do onboarding, editor, catálogo, analytics e moderação.
          </p>
        </header>

        <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
          <MessageSquareText className="size-5 text-primary" />
          <p className="font-semibold">
            {numeric(meta, 'total') || items.length} relatos encontrados
          </p>
        </section>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <MessageSquareText className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Nenhum feedback nesta fila</h2>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <FeedbackCard key={numeric(item, 'id')} item={item} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
