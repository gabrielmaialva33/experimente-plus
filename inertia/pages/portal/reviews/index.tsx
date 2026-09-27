import { Head, Link, router, useForm } from '@inertiajs/react'
import { MessageSquareText, Star } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { MainLayout } from '~/layouts/main_layout'
import { cn } from '~/lib/utils'

type Filter = 'unanswered' | 'answered' | 'all'

type Place = { id: number; name: string; unanswered: number; can_reply: boolean }

type Review = {
  id: number
  rating: number
  comment: string | null
  created_at: string
  edited_at: string | null
  author_name: string
  photos: { url: string | null; alt_text: string | null }[]
  reply: {
    comment: string
    status: 'published' | 'hidden'
    created_at: string
    edited_at: string | null
  } | null
}

type PartnerReviewsPageProps = {
  places: Place[]
  selected_place_id: number | null
  filter: Filter
  counts: { unanswered: number; answered: number; all: number }
  average: number | null
  reviews: Review[]
  meta: { current_page: number; last_page: number; total: number }
}

/** The same limit as the API; the counter shows how much room is left. */
const MAX_REPLY = 4000

const FILTER_LABELS: Record<Filter, string> = {
  unanswered: 'Sem resposta',
  answered: 'Respondidas',
  all: 'Todas',
}

/**
 * Dates in the operation's time zone, on the server and in the browser alike:
 * without it the SSR document and the hydrated page disagree about the hour.
 */
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase()
}

function reviewsHref(placeId: number | null, filter: Filter, page = 1) {
  const params = new URLSearchParams()
  if (placeId !== null) params.set('establishment', String(placeId))
  params.set('filter', filter)
  if (page > 1) params.set('page', String(page))
  return `/portal/reviews?${params.toString()}`
}

function describeAverage(average: number | null, total: number) {
  if (total === 0 || average === null) return 'Ainda não há avaliações publicadas.'
  const formatted = average.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `Média ${formatted} em ${total === 1 ? '1 avaliação' : `${total} avaliações`}`
}

export default function PartnerReviewsPage({
  places,
  selected_place_id: selectedPlaceId,
  filter,
  counts,
  average,
  reviews,
  meta,
}: PartnerReviewsPageProps) {
  const place = places.find((item) => item.id === selectedPlaceId) ?? null

  const filters = place ? (
    <nav
      aria-label="Filtrar avaliações"
      className="flex w-full min-w-0 max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1 sm:inline-flex sm:w-auto"
    >
      {(['unanswered', 'answered', 'all'] as const).map((item) => (
        <Link
          key={item}
          href={reviewsHref(place.id, item)}
          aria-current={filter === item ? 'true' : undefined}
          className={cn(
            // The three filters share a phone's width instead of scrolling the selected one away.
            'inline-flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full px-2.5 text-[0.8125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted motion-reduce:transition-none sm:flex-none sm:px-4.5 sm:text-[0.9375rem]',
            filter === item
              ? 'bg-primary font-bold text-primary-foreground'
              : 'font-semibold text-foreground hover:bg-background'
          )}
        >
          {FILTER_LABELS[item]} ({counts[item]})
        </Link>
      ))}
    </nav>
  ) : null

  return (
    <MainLayout>
      <Head title="Avaliações" />

      <div className="space-y-6">
        <PageHeader
          title="Avaliações"
          description={
            place ? `${place.name} · ${describeAverage(average, counts.all)}` : undefined
          }
          className="sm:items-end"
          actions={
            places.length > 1 || filters ? (
              <div className="flex w-full min-w-0 flex-wrap items-end gap-3 sm:w-auto">
                {places.length > 1 ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="review-place" className="font-bold">
                      Lugar
                    </Label>
                    <select
                      id="review-place"
                      value={selectedPlaceId ?? ''}
                      onChange={(event) =>
                        router.get('/portal/reviews', { establishment: event.target.value })
                      }
                      className="h-11 min-w-56 rounded-full border border-input bg-card px-4 text-[0.9375rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {places.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.unanswered > 0
                            ? `${item.name} (${item.unanswered} sem resposta)`
                            : item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {filters}
              </div>
            ) : null
          }
        />

        {place === null ? (
          <EmptyState
            className="rounded-card border border-dashed border-border bg-card"
            headingLevel={2}
            icon={MessageSquareText}
            title="Nenhum lugar para acompanhar"
            description="Quando um lugar da sua organização for publicado, as avaliações dele aparecem aqui."
          >
            <Button asChild variant="outline" size="lg" shape="pill">
              <Link href="/portal">Voltar à visão geral</Link>
            </Button>
          </EmptyState>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21.25rem]">
            <section aria-label="Lista de avaliações" className="space-y-4">
              {reviews.length === 0 ? (
                <EmptyState
                  className="rounded-card border border-dashed border-border bg-card"
                  headingLevel={2}
                  icon={MessageSquareText}
                  title={
                    filter === 'unanswered'
                      ? 'Nenhuma avaliação esperando resposta'
                      : filter === 'answered'
                        ? 'Nenhuma avaliação respondida ainda'
                        : 'Ainda não há avaliações deste lugar'
                  }
                  description={
                    filter === 'all'
                      ? 'Quando alguém avaliar este lugar pelo app ou pelo site, a avaliação aparece aqui.'
                      : undefined
                  }
                >
                  {filter !== 'all' && counts.all > 0 ? (
                    <Button asChild variant="outline" size="lg" shape="pill">
                      <Link href={reviewsHref(place.id, 'all')}>Ver todas as avaliações</Link>
                    </Button>
                  ) : null}
                </EmptyState>
              ) : (
                reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} canReply={place.can_reply} />
                ))
              )}

              {meta.last_page > 1 ? (
                <div className="flex items-center justify-between gap-3">
                  {meta.current_page > 1 ? (
                    <Button asChild variant="outline" size="lg" shape="pill">
                      <Link href={reviewsHref(place.id, filter, meta.current_page - 1)}>
                        Mais recentes
                      </Link>
                    </Button>
                  ) : (
                    <span />
                  )}
                  <span className="text-sm text-muted-foreground">
                    Página {meta.current_page} de {meta.last_page}
                  </span>
                  {meta.current_page < meta.last_page ? (
                    <Button asChild variant="outline" size="lg" shape="pill">
                      <Link href={reviewsHref(place.id, filter, meta.current_page + 1)}>
                        Mais antigas
                      </Link>
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              ) : null}
            </section>

            <aside
              aria-label="Dicas para responder"
              className="space-y-3 rounded-card bg-primary-soft p-5.5 text-sm"
            >
              <h2 className="font-display text-lg font-extrabold text-primary-accent">
                Uma boa resposta
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-[0.9375rem] leading-snug">
                <li>Agradece a visita.</li>
                <li>É cordial também com as críticas.</li>
                <li>Não expõe dados de clientes.</li>
              </ul>
              <p>
                Avaliação ofensiva ou falsa? Use o link Denunciar do app ou do site; a moderação
                analisa.
              </p>
            </aside>
          </div>
        )}
      </div>
    </MainLayout>
  )
}

function ReviewCard({ review, canReply }: { review: Review; canReply: boolean }) {
  const [editing, setEditing] = useState(false)

  return (
    <article
      aria-labelledby={`review-${review.id}-author`}
      className="space-y-4 rounded-card border border-border-subtle bg-card p-5 sm:p-6.5"
    >
      <header className="flex flex-wrap items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-extrabold text-primary-accent"
        >
          {initials(review.author_name) || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p id={`review-${review.id}-author`} className="text-[1.0625rem] font-bold">
            {review.author_name}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatDate(review.created_at)}
            {review.edited_at ? ' · editada' : ''}
          </p>
        </div>
        <Badge
          variant="warning"
          appearance="light"
          shape="pill"
          size="lg"
          className="h-9 px-3.5 text-[0.9375rem] font-extrabold [&_svg]:size-4"
          aria-label={`Nota ${review.rating} de 5`}
        >
          <Star aria-hidden="true" className="fill-current" />
          {review.rating} de 5
        </Badge>
      </header>

      {review.comment ? (
        <p className="whitespace-pre-line text-[1.0625rem] leading-relaxed">{review.comment}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Avaliação só com a nota.</p>
      )}

      {review.photos.length > 0 ? (
        <ul aria-label="Fotos da avaliação" className="flex flex-wrap gap-2">
          {review.photos.map((photo, index) =>
            photo.url ? (
              <li key={`${photo.url}-${index}`}>
                <img
                  src={photo.url}
                  alt={photo.alt_text ?? `Foto ${index + 1} da avaliação`}
                  className="size-20 rounded-2xl object-cover"
                />
              </li>
            ) : null
          )}
        </ul>
      ) : null}

      <div className="border-t border-border-subtle pt-4">
        {review.reply && !editing ? (
          <div className="space-y-2.5 rounded-2xl bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-primary-accent">Sua resposta</p>
              {review.reply.status === 'hidden' ? (
                <Badge variant="info" appearance="light" shape="pill" className="font-bold">
                  Em análise pela moderação
                </Badge>
              ) : null}
              {review.reply.edited_at ? (
                <span className="text-xs text-muted-foreground">editada</span>
              ) : null}
            </div>
            <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed">
              {review.reply.comment}
            </p>
            {canReply ? (
              <Button variant="outline" shape="pill" onClick={() => setEditing(true)}>
                Editar resposta
              </Button>
            ) : null}
          </div>
        ) : canReply ? (
          <ReplyForm
            reviewId={review.id}
            initial={review.reply?.comment ?? ''}
            mode={review.reply ? 'update' : 'create'}
            onCancel={review.reply ? () => setEditing(false) : undefined}
            onDone={() => setEditing(false)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Seu acesso a esta organização permite ver as avaliações, mas não responder.
          </p>
        )}
      </div>
    </article>
  )
}

function ReplyForm({
  reviewId,
  initial,
  mode,
  onCancel,
  onDone,
}: {
  reviewId: number
  initial: string
  mode: 'create' | 'update'
  onCancel?: () => void
  onDone: () => void
}) {
  const form = useForm({ comment: initial })
  const fieldId = `reply-${reviewId}`
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const url = `/portal/reviews/${reviewId}/reply`
    const options = { preserveScroll: true, onSuccess: onDone }
    if (mode === 'create') form.post(url, options)
    else form.put(url, options)
  }

  return (
    <form onSubmit={submit} className="space-y-2.5" noValidate>
      <Label htmlFor={fieldId} className="text-base font-bold">
        {mode === 'create' ? 'Sua resposta pública' : 'Editar sua resposta'}
      </Label>
      <Textarea
        id={fieldId}
        rows={4}
        maxLength={MAX_REPLY}
        value={form.data.comment}
        onChange={(event) => form.setData('comment', event.target.value)}
        placeholder="Agradeça a visita e, se fizer sentido, conte o que vocês fazem a respeito."
        className="min-h-28 rounded-2xl px-4 py-3.5 text-base leading-normal shadow-none"
        aria-invalid={form.errors.comment ? true : undefined}
        aria-describedby={form.errors.comment ? `${hintId} ${errorId}` : hintId}
      />
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
        <span id={hintId}>Aparece abaixo da avaliação, no app e no site. A nota não muda.</span>
        <span aria-hidden="true">
          {form.data.comment.length}/{MAX_REPLY}
        </span>
      </div>
      {form.errors.comment ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {form.errors.comment}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" variant="primary" size="xl" shape="pill" disabled={form.processing}>
          {mode === 'create' ? 'Publicar resposta' : 'Salvar resposta'}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="primary"
            appearance="ghost"
            size="xl"
            shape="pill"
            onClick={onCancel}
            disabled={form.processing}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  )
}
