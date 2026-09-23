import { Link } from '@inertiajs/react'
import { CalendarClock, CalendarDays, Sparkles, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { CatalogImageFallback } from '~/components/catalog/catalog_image_fallback'
import { formatEventWindow } from '~/components/catalog/establishment_partner_content'
import { EmptyState } from '~/components/empty_state'

/**
 * The city's agenda — three chronological bands, no ranking.
 *
 * The ordering, the windows and the caps are the server's. This component never
 * re-sorts, never re-filters and never decides what is "featured": there is no
 * prominence contract for partner content, so "Novidades" is labelled as recency
 * and nothing here promises more than that.
 *
 * There is no loading state because there is nothing to load. The agenda arrives
 * as an SSR prop of the city page, and the only other value it takes is `null` —
 * which the controller uses to say "not this view", not "not yet".
 */

interface JsonRecord {
  [key: string]: unknown
}

export interface CityAgendaCover {
  url: string
  altText: string
  width: number | null
  height: number | null
}

interface CityAgendaItemBase {
  id: number
  title: string
  description: string | null
  cover: CityAgendaCover | null
  establishmentSlug: string
  establishmentName: string
  citySlug: string
}

export interface CityAgendaEvent extends CityAgendaItemBase {
  startsAt: string
  endsAt: string
}

export interface CityAgendaExperience extends CityAgendaItemBase {
  publishedAt: string
}

export interface CityAgenda {
  city: {
    slug: string
    name: string
    stateCode: string | null
    timezone: string | null
  }
  localDate: string | null
  happeningToday: CityAgendaEvent[]
  upcoming: CityAgendaEvent[]
  newExperiences: CityAgendaExperience[]
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null
}

function cover(value: unknown): CityAgendaCover | null {
  const row = asRecord(value)
  const url = text(row?.url)
  const altText = text(row?.alt_text)

  // Approved media always carries alternative text, so a cover without it is a
  // shape we do not trust — the fallback tile is the safer answer.
  if (!url || !altText) return null

  return { url, altText, width: integer(row?.width), height: integer(row?.height) }
}

function itemBase(value: unknown): CityAgendaItemBase | null {
  const row = asRecord(value)
  const establishment = asRecord(row?.establishment)
  const id = integer(row?.id)
  const title = text(row?.title)
  const establishmentSlug = text(establishment?.slug)
  const establishmentName = text(establishment?.name)
  const citySlug = text(row?.city_slug)

  if (id === null || !title || !establishmentSlug || !establishmentName || !citySlug) {
    return null
  }

  return {
    id,
    title,
    description: text(row?.description),
    cover: cover(row?.cover),
    establishmentSlug,
    establishmentName,
    citySlug,
  }
}

/**
 * Normalizes the payload without reordering it.
 *
 * `flatMap` preserves the server's order, and a malformed row is dropped instead
 * of rendered as a card that leads nowhere.
 */
export function cityAgenda(value: unknown): CityAgenda | null {
  const payload = asRecord(value)
  const city = asRecord(payload?.city)
  const slug = text(city?.slug)
  const name = text(city?.name)

  if (!slug || !name) return null

  return {
    city: {
      slug,
      name,
      stateCode: text(city?.state_code),
      timezone: text(city?.timezone),
    },
    localDate: text(payload?.local_date),
    happeningToday: events(payload?.happening_today),
    upcoming: events(payload?.upcoming),
    newExperiences: experiences(payload?.new_experiences),
  }
}

function events(value: unknown): CityAgendaEvent[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const base = itemBase(entry)
    const row = asRecord(entry)
    const startsAt = text(row?.starts_at)
    const endsAt = text(row?.ends_at)

    if (!base || !startsAt || !endsAt) return []
    return [{ ...base, startsAt, endsAt }]
  })
}

function experiences(value: unknown): CityAgendaExperience[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const base = itemBase(entry)
    const publishedAt = text(asRecord(entry)?.published_at)

    if (!base || !publishedAt) return []
    return [{ ...base, publishedAt }]
  })
}

function establishmentHref(citySlug: string, establishmentSlug: string): string {
  return `/cidades/${encodeURIComponent(citySlug)}/estabelecimentos/${encodeURIComponent(establishmentSlug)}`
}

function AgendaCard({
  item,
  meta,
  bandKey,
}: {
  item: CityAgendaItemBase
  meta: string | null
  bandKey: string
}) {
  const titleId = `city-agenda-${bandKey}-${item.id}-title`
  const placeId = `city-agenda-${bandKey}-${item.id}-place`

  return (
    <li className="min-w-0">
      <Link
        href={establishmentHref(item.citySlug, item.establishmentSlug)}
        aria-labelledby={titleId}
        aria-describedby={placeId}
        className="group block h-full min-w-0 rounded-lg outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border bg-card transition-colors group-hover:border-primary motion-reduce:transition-none">
          {item.cover ? (
            <img
              src={item.cover.url}
              alt={item.cover.altText}
              width={item.cover.width ?? undefined}
              height={item.cover.height ?? undefined}
              loading="lazy"
              decoding="async"
              className="aspect-[16/9] w-full border-b object-cover"
            />
          ) : (
            <CatalogImageFallback
              name={item.title}
              categoryName={item.establishmentName}
              className="aspect-[16/9] w-full border-b"
            />
          )}

          <div className="flex flex-1 flex-col p-4">
            {meta ? (
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                {meta}
              </p>
            ) : null}

            <h4 id={titleId} className="mt-2 text-base font-semibold leading-6">
              {item.title}
            </h4>

            <p id={placeId} className="mt-1 truncate text-sm text-muted-foreground">
              {item.establishmentName}
            </p>

            {item.description ? (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            ) : null}
          </div>
        </article>
      </Link>
    </li>
  )
}

function AgendaBand({
  bandKey,
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
}: {
  bandKey: string
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  children: ReactNode
}) {
  const headingId = `city-agenda-${bandKey}-heading`

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          <Icon aria-hidden="true" className="size-3.5" />
          {eyebrow}
        </p>
        <h3 id={headingId} className="mt-1 text-lg font-semibold">
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>
    </section>
  )
}

export function CityAgendaSection({ agenda }: { agenda: unknown }) {
  const parsed = cityAgenda(agenda)

  if (!parsed) return null

  const timeZone = parsed.city.timezone
  const bands = [
    {
      key: 'happening-today',
      icon: CalendarClock,
      eyebrow: 'Hoje na cidade',
      title: 'Acontecendo hoje',
      description: `Eventos publicados cuja programação alcança hoje no fuso de ${parsed.city.name}.`,
      items: parsed.happeningToday.map((item) => ({
        item,
        meta: formatEventWindow(item.startsAt, item.endsAt, timeZone),
      })),
    },
    {
      key: 'upcoming',
      icon: CalendarDays,
      eyebrow: 'Programe-se',
      title: 'Em breve',
      description: 'Eventos anunciados para os próximos dias, em ordem de início.',
      items: parsed.upcoming.map((item) => ({
        item,
        meta: formatEventWindow(item.startsAt, item.endsAt, timeZone),
      })),
    },
    {
      key: 'new-experiences',
      icon: Sparkles,
      eyebrow: 'Publicado recentemente',
      title: 'Novidades',
      // Chronological, and said out loud: this is recency, not a ranking, not a
      // curation and not a paid placement.
      description: 'Experiências publicadas mais recentemente, da mais nova para a mais antiga.',
      items: parsed.newExperiences.map((item) => ({ item, meta: null })),
    },
  ].filter((band) => band.items.length > 0)

  return (
    <section aria-labelledby="city-agenda-heading" className="mt-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Agenda da cidade
        </p>
        <h2 id="city-agenda-heading" className="mt-1 text-xl font-semibold">
          O que está acontecendo em {parsed.city.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Eventos e experiências publicados pelos estabelecimentos, em ordem cronológica.
        </p>
      </div>

      {bands.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card">
          <EmptyState
            title="Nenhuma programação publicada para estes dias"
            description="Assim que um estabelecimento publicar um evento ou uma nova experiência, a agenda aparece aqui."
            icon={CalendarClock}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {bands.map((band) => (
            <AgendaBand
              key={band.key}
              bandKey={band.key}
              eyebrow={band.eyebrow}
              title={band.title}
              description={band.description}
              icon={band.icon}
            >
              {band.items.map(({ item, meta }) => (
                <AgendaCard key={item.id} item={item} meta={meta} bandKey={band.key} />
              ))}
            </AgendaBand>
          ))}
        </div>
      )}
    </section>
  )
}
