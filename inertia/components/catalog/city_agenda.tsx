import { Link } from '@inertiajs/react'
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import {
  CatalogCoverImage,
  CatalogImageFallback,
} from '~/components/catalog/catalog_image_fallback'
import { CatalogSectionHeader } from '~/components/catalog/catalog_section_header'
import {
  formatEventWindow,
  partnerContentAnchor,
} from '~/components/catalog/establishment_partner_content'
import { EmptyState } from '~/components/empty_state'
import { Button } from '~/components/ui/button'

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

/**
 * The item's place, opened on the item: an experience or an event has no page of
 * its own, and landing at the top of the place would leave it screens away.
 */
function itemHref(item: CityAgendaItemBase, kind: 'events' | 'experiences'): string {
  return `/cidades/${encodeURIComponent(item.citySlug)}/estabelecimentos/${encodeURIComponent(item.establishmentSlug)}#${partnerContentAnchor(kind, item.id)}`
}

/**
 * Direction A's date tile: weekday as an overline, the day large, the month
 * below — read in the city's timezone. Decorative: the card's own text carries
 * the full window, so without a trustworthy timezone there is simply no tile.
 */
function dateTileParts(
  value: string,
  timeZone: string | null
): { weekday: string; day: string; month: string } | null {
  const date = new Date(value)
  if (!timeZone || Number.isNaN(date.getTime())) return null

  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone,
    }).formatToParts(date)
  } catch {
    return null
  }

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((entry) => entry.type === type)?.value ?? '').replace('.', '')
  return {
    weekday: part('weekday').toLocaleUpperCase('pt-BR'),
    day: part('day'),
    month: part('month').toLocaleUpperCase('pt-BR'),
  }
}

function DateTile({ startsAt, timeZone }: { startsAt: string; timeZone: string | null }) {
  const parts = dateTileParts(startsAt, timeZone)
  if (!parts) return null

  return (
    <span
      aria-hidden="true"
      data-slot="date-tile"
      className="absolute left-3 top-3 flex h-[4.5rem] w-16 flex-col items-center justify-center rounded-2xl bg-card text-foreground"
    >
      <span className="text-[0.6875rem] font-extrabold tracking-[0.1em] text-primary-accent">
        {parts.weekday}
      </span>
      <span className="font-display text-[1.625rem] font-extrabold leading-none">{parts.day}</span>
      <span className="mt-0.5 text-[0.6875rem] font-bold text-muted-foreground">{parts.month}</span>
    </span>
  )
}

function AgendaCard({
  item,
  kind,
  meta,
  bandKey,
  startsAt = null,
  timeZone = null,
}: {
  item: CityAgendaItemBase
  kind: 'events' | 'experiences'
  meta: string | null
  bandKey: string
  startsAt?: string | null
  timeZone?: string | null
}) {
  const titleId = `city-agenda-${bandKey}-${item.id}-title`
  const placeId = `city-agenda-${bandKey}-${item.id}-place`

  return (
    <li className="w-[82%] min-w-0 shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]">
      <Link
        href={itemHref(item, kind)}
        aria-labelledby={titleId}
        aria-describedby={placeId}
        className="group block h-full min-w-0 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-border-subtle bg-card transition-colors group-hover:border-primary motion-reduce:transition-none">
          <div className="relative">
            {item.cover ? (
              <CatalogCoverImage
                src={item.cover.url}
                alt={item.cover.altText}
                name={item.title}
                categoryName={item.establishmentName}
                width={item.cover.width}
                height={item.cover.height}
                className="aspect-[16/9] w-full object-cover"
              />
            ) : (
              <CatalogImageFallback
                name={item.title}
                categoryName={item.establishmentName}
                className="aspect-[16/9] w-full"
              />
            )}
            {startsAt ? <DateTile startsAt={startsAt} timeZone={timeZone} /> : null}
          </div>

          <div className="flex flex-1 flex-col p-4">
            {meta ? (
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
                {meta}
              </p>
            ) : null}

            <h4
              id={titleId}
              className="mt-1.5 font-display text-[1.0625rem] font-extrabold leading-snug underline-offset-4 group-hover:underline"
            >
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

/**
 * Whether a rail can move either way, kept in step with its scroll position and
 * size. Measured after mount: the server renders the rail without the buttons,
 * and touch, trackpad and the keyboard (focus scrolls a card into view) all work
 * without them.
 */
function useRail() {
  const ref = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  const measure = useCallback(() => {
    const rail = ref.current
    if (!rail) return
    // One pixel of slack: fractional widths leave the last card a hair short.
    const start = rail.scrollLeft <= 1
    const end = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1
    setEdges((current) =>
      current.start === start && current.end === end ? current : { start, end }
    )
  }, [])

  useEffect(() => {
    const rail = ref.current
    if (!rail) return
    measure()
    rail.addEventListener('scroll', measure, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(rail)
    return () => {
      rail.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [measure])

  const page = (direction: 1 | -1) => {
    const rail = ref.current
    if (!rail) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    rail.scrollBy({ left: direction * rail.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }

  return { ref, edges, page }
}

/**
 * One band of the agenda as a rail: a band is a glance (the server caps it at a
 * dozen items), so it keeps one row at every width instead of stacking up to
 * twelve cards above the city's places. On a phone the next card peeks in from
 * the edge; from 640px two arrows page through it.
 */
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
  const listId = `city-agenda-${bandKey}-list`
  const { ref, edges, page } = useRail()
  const scrollable = !(edges.start && edges.end)

  return (
    <section aria-labelledby={headingId}>
      <CatalogSectionHeader
        id={headingId}
        level={3}
        className="mb-3"
        overline={
          <>
            <Icon aria-hidden="true" className="size-3.5" />
            {eyebrow}
          </>
        }
        title={title}
        description={description}
        action={
          scrollable ? (
            <div className="hidden gap-2 sm:flex">
              <Button
                type="button"
                variant="outline"
                mode="icon"
                shape="circle"
                aria-controls={listId}
                aria-label={`${title}: anteriores`}
                disabled={edges.start}
                onClick={() => page(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                mode="icon"
                shape="circle"
                aria-controls={listId}
                aria-label={`${title}: próximos`}
                disabled={edges.end}
                onClick={() => page(1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          ) : null
        }
      />
      {/* Bleeds to the screen edge on a phone so the next card shows it is there; from
          640px the 4px of padding only keeps a card's focus ring from being clipped. */}
      <ul
        ref={ref}
        id={listId}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 list-none gap-4 overflow-x-auto overscroll-x-contain px-4 pb-3 pt-1 sm:-mx-1 sm:scroll-px-1 sm:px-1"
      >
        {children}
      </ul>
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
      kind: 'events' as const,
      icon: CalendarClock,
      eyebrow: 'Hoje na cidade',
      title: 'Acontecendo hoje',
      description: `Eventos publicados cuja programação alcança hoje no fuso de ${parsed.city.name}.`,
      items: parsed.happeningToday.map((item) => ({
        item,
        meta: formatEventWindow(item.startsAt, item.endsAt, timeZone),
        startsAt: item.startsAt,
      })),
    },
    {
      key: 'upcoming',
      kind: 'events' as const,
      icon: CalendarDays,
      eyebrow: 'Programe-se',
      title: 'Em breve',
      description: 'Eventos anunciados para os próximos dias, em ordem de início.',
      items: parsed.upcoming.map((item) => ({
        item,
        meta: formatEventWindow(item.startsAt, item.endsAt, timeZone),
        startsAt: item.startsAt,
      })),
    },
    {
      key: 'new-experiences',
      kind: 'experiences' as const,
      icon: Sparkles,
      eyebrow: 'Publicado recentemente',
      title: 'Novidades',
      // Chronological, and said out loud: this is recency, not a ranking, not a
      // curation and not a paid placement.
      description: 'Experiências publicadas mais recentemente, da mais nova para a mais antiga.',
      items: parsed.newExperiences.map((item) => ({ item, meta: null, startsAt: null })),
    },
  ].filter((band) => band.items.length > 0)

  return (
    <section aria-labelledby="city-agenda-heading" className="mt-8">
      <CatalogSectionHeader
        id="city-agenda-heading"
        className="mb-5"
        overline="Agenda da cidade"
        title={`O que está acontecendo em ${parsed.city.name}`}
        description="Eventos e experiências publicados pelos lugares da cidade, em ordem cronológica."
      />

      {bands.length === 0 ? (
        <div className="rounded-card border border-dashed bg-card">
          <EmptyState
            title="Nenhuma programação publicada para estes dias"
            description="Assim que um lugar publicar um evento ou uma nova experiência, a agenda aparece aqui."
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
              {band.items.map(({ item, meta, startsAt }) => (
                <AgendaCard
                  key={item.id}
                  item={item}
                  kind={band.kind}
                  meta={meta}
                  bandKey={band.key}
                  startsAt={startsAt}
                  timeZone={timeZone}
                />
              ))}
            </AgendaBand>
          ))}
        </div>
      )}
    </section>
  )
}
