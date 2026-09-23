import { Link } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import {
  askCatalogConcierge,
  establishmentPathOf,
  type ConciergeItem,
  type ConciergeReply,
} from '~/lib/concierge'

const MAX_QUESTION_LENGTH = 300

/** How each species is named next to its host, in the reference list. */
const KIND_LABEL: Record<NonNullable<ConciergeItem['kind']>, string> = {
  establishment: 'Lugar',
  experience: 'Experiência',
  event: 'Evento',
}

interface CatalogConciergeProps {
  citySlug: string
  cityName: string
}

export function CatalogConcierge({ citySlug, cityName }: CatalogConciergeProps) {
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState<ConciergeReply | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const request = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      request.current?.abort()
    },
    []
  )

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalized = question.trim()
    if (normalized.length < 3 || loading) return

    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(false)
    setReply(null)

    try {
      const result = await askCatalogConcierge(normalized, citySlug, controller.signal)
      if (!controller.signal.aborted) setReply(result)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (request.current === controller) {
        request.current = null
        setLoading(false)
      }
    }
  }

  const canSubmit = question.trim().length >= 3 && !loading

  return (
    <section
      aria-labelledby="catalog-concierge-title"
      className="mt-6 rounded-lg border bg-card p-5 sm:p-6"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Concierge
          </p>
          <h2 id="catalog-concierge-title" className="mt-1 text-xl font-semibold">
            O que você quer fazer em {cityName}?
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Peça ideias de lugares e roteiros. As sugestões são ancoradas somente no catálogo
            publicado do Experimente+ e não fazem reservas ou compras por você.
          </p>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <label htmlFor="catalog-concierge-question" className="text-sm font-medium">
            Sua pergunta
          </label>
          <Textarea
            id="catalog-concierge-question"
            aria-label="Pergunta para o Concierge"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ex.: quero um café tranquilo e depois algo para fazer à tarde"
            maxLength={MAX_QUESTION_LENGTH}
            rows={3}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {question.length}/{MAX_QUESTION_LENGTH}
            </span>
            <Button type="submit" disabled={!canSubmit}>
              {loading ? 'Pensando…' : 'Perguntar'}
            </Button>
          </div>
        </form>
      </div>

      {error ? (
        <p
          role="status"
          className="mt-5 rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive-accent"
        >
          Não foi possível consultar agora. Tente novamente em instantes.
        </p>
      ) : null}

      {reply ? (
        <div
          aria-live="polite"
          className="mt-5 rounded-md border border-primary/15 bg-primary-soft p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary-accent">
            {reply.outcome === 'grounded'
              ? 'Sugestão ancorada no catálogo'
              : reply.outcome === 'refused'
                ? 'Posso ajudar com descoberta local'
                : 'Sugestões do catálogo'}
          </p>

          {reply.text ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-6">{reply.text}</p>
          ) : reply.outcome === 'degraded' ? (
            <p className="mt-2 text-sm leading-6">
              O assistente está indisponível agora, então trouxe opções publicadas no catálogo.
            </p>
          ) : null}

          {reply.items.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Referências no catálogo">
              {reply.items.map((item, index) => {
                const titleId = `catalog-concierge-reference-${index}`
                const hostId = `${titleId}-host`
                const kind = item.kind
                const name = item.name ?? 'Item publicado'
                const meta = [item.category, item.district].filter(Boolean).join(' · ')
                const host =
                  kind && kind !== 'establishment' ? (item.establishment_name ?? null) : null

                // The link is derived, never received: an item without slugs is
                // rendered as text, because a guessed address is an invented one.
                const href = establishmentPathOf(item)

                const card = (
                  <>
                    <p
                      id={titleId}
                      className="text-sm font-semibold underline-offset-4 group-hover:underline"
                    >
                      {name}
                    </p>
                    {host && kind ? (
                      <p id={hostId} className="mt-0.5 text-xs text-primary-accent">
                        {KIND_LABEL[kind]} em {host}
                      </p>
                    ) : null}
                    {meta ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
                    ) : null}
                  </>
                )

                return (
                  <li
                    key={item.ref ?? `${name}-${index}`}
                    className="rounded-md border border-primary/15 bg-card px-3 py-2"
                  >
                    {href ? (
                      <Link
                        href={href}
                        aria-labelledby={host ? `${titleId} ${hostId}` : titleId}
                        className="group block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {card}
                      </Link>
                    ) : (
                      card
                    )}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
