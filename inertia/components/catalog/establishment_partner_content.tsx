interface JsonRecord {
  [key: string]: unknown
}

export interface PartnerContentPayload {
  experiences?: unknown
  events?: unknown
  showcase_items?: unknown
}

type PartnerContentKind = 'experiences' | 'events' | 'showcase-items'

interface PublicMedia {
  id: number
  isCover: boolean
  altText: string
  caption: string | null
  url: string
}

interface PublishedContent {
  id: number
  title: string
  description: string | null
  startsAt: string | null
  endsAt: string | null
  informationalPriceCents: number | null
  media: PublicMedia[]
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function publicMedia(value: unknown): PublicMedia[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const row = asRecord(entry)
    const asset = asRecord(row?.asset)
    const id = typeof row?.id === 'number' ? row.id : null
    const url = text(asset?.url)
    const altText = text(row?.alt_text)

    if (id === null || !url || !altText) return []

    return [
      {
        id,
        isCover: row?.is_cover === true,
        altText,
        caption: text(row?.caption),
        url,
      },
    ]
  })
}

/**
 * The public payload, read as it arrives.
 *
 * The publication rule of ADR-0028 §4 is no longer implemented here. The server
 * now derives every field from the approved snapshot and drops the live columns,
 * the lifecycle and its own identifiers before the payload leaves the process, so
 * this component reads `title`, `description`, `starts_at`, `ends_at` and
 * `informational_price_cents` directly — and deliberately never reads
 * `published_snapshot`, `status` or anything else a browser should not have been
 * given. Two clients re-deriving the same rule was the drift ADR-0016 §6 forbids.
 *
 * What remains is shape tolerance, not policy: a malformed item is dropped rather
 * than rendered as a card with nothing in it.
 */
export function publishedPartnerContent(
  value: unknown,
  kind: PartnerContentKind
): PublishedContent[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const row = asRecord(entry)
    const id = typeof row?.id === 'number' ? row.id : null
    const title = text(row?.title)

    if (id === null || !title) return []

    const startsAt = kind === 'events' ? text(row?.starts_at) : null
    const endsAt = kind === 'events' ? text(row?.ends_at) : null
    if (kind === 'events' && (!startsAt || !endsAt)) return []

    const rawPrice = row?.informational_price_cents
    const informationalPriceCents =
      kind === 'showcase-items' && typeof rawPrice === 'number' && Number.isFinite(rawPrice)
        ? Math.max(0, Math.trunc(rawPrice))
        : null

    return [
      {
        id,
        title,
        description: text(row?.description),
        startsAt,
        endsAt,
        informationalPriceCents,
        media: publicMedia(row?.media),
      },
    ]
  })
}

/**
 * An event window, read in the city's timezone.
 *
 * Exported because the city agenda shows the same window in the same words, and
 * a second implementation would be a second way to disagree about which day an
 * event happens on. An unusable zone falls back to UTC instead of throwing: a
 * misconfigured city must still render a date.
 *
 * This is not the portal's `zonedLocalToIso`/`isoToZonedLocal` pair and must not
 * be merged with it — those convert an author's local input into an instant, this
 * one formats an approved instant for a reader.
 */
export function formatEventWindow(
  startsAt: string | null,
  endsAt: string | null,
  timeZone: string | null
): string | null {
  if (!startsAt || !endsAt) return null
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

  const format = (zone: string) => {
    const day = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: zone }).format(
      start
    )
    const clock = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zone,
    })
    return `${day} · ${clock.format(start)}–${clock.format(end)}`
  }

  try {
    return format(timeZone ?? 'UTC')
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return format('UTC')
  }
}

export function formatPrice(cents: number | null): string | null {
  if (cents === null) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function EstablishmentPartnerContent({
  content,
  timeZone,
}: {
  content: PartnerContentPayload | null | undefined
  timeZone: string | null
}) {
  const sections = [
    {
      key: 'experiences',
      eyebrow: 'Para viver aqui',
      title: 'Experiências',
      items: publishedPartnerContent(content?.experiences, 'experiences'),
    },
    {
      key: 'events',
      eyebrow: 'Na agenda',
      title: 'Eventos',
      items: publishedPartnerContent(content?.events, 'events'),
    },
    {
      key: 'showcase-items',
      eyebrow: 'Em destaque',
      title: 'Vitrine',
      items: publishedPartnerContent(content?.showcase_items, 'showcase-items'),
    },
  ].filter((section) => section.items.length > 0)

  if (sections.length === 0) return null

  return (
    <section
      aria-labelledby="partner-content-title"
      className="rounded-lg border bg-card p-5 sm:p-6"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Novidades do parceiro
        </p>
        <h2 id="partner-content-title" className="mt-1 text-xl font-semibold">
          Descubra mais neste lugar
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Experiências, eventos e itens informativos publicados pelo estabelecimento.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {sections.map((section) => (
          <div key={section.key}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              {section.eyebrow}
            </p>
            <h3 className="mt-1 text-base font-semibold">{section.title}</h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {section.items.map((item) => {
                const eventWindow =
                  section.key === 'events'
                    ? formatEventWindow(item.startsAt, item.endsAt, timeZone)
                    : null
                const price =
                  section.key === 'showcase-items'
                    ? formatPrice(item.informationalPriceCents)
                    : null
                const cover = item.media.find((media) => media.isCover) ?? item.media[0] ?? null

                return (
                  <article key={item.id} className="overflow-hidden rounded-md border bg-card">
                    {cover ? (
                      <figure>
                        <div className="aspect-[16/9] overflow-hidden bg-muted">
                          <img
                            src={cover.url}
                            alt={cover.altText}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        </div>
                        {cover.caption ? (
                          <figcaption className="px-4 pt-2 text-xs text-muted-foreground">
                            {cover.caption}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-semibold leading-6">{item.title}</h4>
                        {price ? (
                          <span className="shrink-0 text-sm font-semibold text-cta-accent">
                            {price}
                          </span>
                        ) : null}
                      </div>
                      {eventWindow ? (
                        <p className="mt-1 text-xs font-medium text-primary">{eventWindow}</p>
                      ) : null}
                      {item.description ? (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
