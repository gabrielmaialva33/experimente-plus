import { MessageSquareText } from 'lucide-react'

import { RatingStars, formatRating } from '~/components/catalog/rating_stars'
import { ReportDialog } from '~/components/catalog/report_dialog'

export type PublicReviewItem = {
  id: number
  rating: number
  comment: string | null
  created_at: string | null
  author_name: string
  reply: { comment: string; created_at: string | null } | null
  photos: { url: string; alt_text: string | null; width: number | null; height: number | null }[]
}

export type PublicReviewsPayload = {
  summary: { count: number; average: number | null }
  latest: PublicReviewItem[]
}

function formatReviewDate(value: string | null, timeZone: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeZone: timeZone ?? 'America/Sao_Paulo',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(date)
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)
  ).toUpperCase()
}

/**
 * The reviews on a place's public web page — W10 of the web audit.
 *
 * Read-only, like the rest of the public page: people review in the app. The
 * average is the projection's (the same number the app shows), drawn with half
 * stars and read as "4,5 de 5"; each review and partner reply can be reported
 * anonymously, through the same route the app uses.
 */
export function EstablishmentReviews({
  reviews,
  placeName,
  timeZone,
}: {
  reviews: PublicReviewsPayload | undefined
  placeName: string
  timeZone: string | null
}) {
  const summary = reviews?.summary ?? { count: 0, average: null }
  const latest = reviews?.latest ?? []
  const countLabel = summary.count === 1 ? '1 avaliação' : `${summary.count} avaliações`

  return (
    <section
      aria-labelledby="reviews-title"
      className="rounded-card border border-border-subtle bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
            O que dizem
          </p>
          <h2 id="reviews-title" className="mt-1 font-display text-[1.3125rem] font-extrabold">
            Avaliações
          </h2>
        </div>
        {summary.average !== null && summary.count > 0 ? (
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold">
            <span className="font-display text-2xl font-extrabold">
              {formatRating(summary.average)}
            </span>
            <RatingStars value={summary.average} size={18} />
            <span className="text-muted-foreground">· {countLabel}</span>
          </p>
        ) : null}
      </div>

      {latest.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl bg-background px-4 py-8 text-center">
          <MessageSquareText aria-hidden="true" className="size-6 text-muted-foreground" />
          <p className="font-semibold">Ainda não há avaliações deste lugar.</p>
          <p className="text-sm text-muted-foreground">
            Quem visitar pode avaliar pelo app Experimente+.
          </p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {latest.map((review) => {
            const date = formatReviewDate(review.created_at, timeZone)
            return (
              <li key={review.id}>
                <article
                  aria-label={`Avaliação de ${review.author_name}`}
                  className="flex flex-col gap-3 rounded-2xl border border-border-subtle p-4"
                >
                  <header className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-primary-accent"
                    >
                      {initials(review.author_name)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-bold">{review.author_name}</span>
                      {date ? (
                        <span className="text-[0.8125rem] text-muted-foreground">{date}</span>
                      ) : null}
                    </span>
                    <RatingStars value={review.rating} />
                  </header>
                  {review.comment ? (
                    <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed">
                      {review.comment}
                    </p>
                  ) : null}
                  {review.photos.length > 0 ? (
                    <ul aria-label="Fotos da avaliação" className="flex flex-wrap gap-2">
                      {review.photos.map((photo) => (
                        <li key={photo.url}>
                          <img
                            src={photo.url}
                            alt={photo.alt_text ?? `Foto enviada por ${review.author_name}`}
                            width={photo.width ?? undefined}
                            height={photo.height ?? undefined}
                            loading="lazy"
                            decoding="async"
                            className="size-20 rounded-xl object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {review.reply ? (
                    <div className="rounded-xl bg-background px-4 py-3">
                      <p className="text-[0.8125rem] font-bold text-primary-accent">
                        Resposta de {placeName}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                        {review.reply.comment}
                      </p>
                    </div>
                  ) : null}
                  <div className="-mb-2 -ml-2 flex flex-wrap gap-1">
                    <ReportDialog
                      targetType="review"
                      targetId={review.id}
                      subject={`avaliação de ${review.author_name}`}
                    />
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
