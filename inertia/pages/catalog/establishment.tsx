import { Link } from '@inertiajs/react'
import {
  Building2,
  CalendarClock,
  Check,
  CircleAlert,
  Clock3,
  ImageIcon,
  Info,
  MapPin,
  Sparkles,
} from 'lucide-react'

import CatalogShell from '~/components/catalog/catalog_shell'
import { EstablishmentActions } from '~/components/catalog/establishment_actions'
import { useEstablishmentViewAnalytics } from '~/components/catalog/use_catalog_analytics'
import { Badge } from '~/components/ui/badge'
import {
  availabilityLabel,
  businessStatusLabel,
  catalogDetail,
  formatCatalogAddress,
  weekdayLabel,
  type CatalogAttribute,
  type CatalogDetail,
  type CatalogHistoricalDetail,
  type CatalogHour,
} from '~/lib/catalog'
import { cn } from '~/lib/utils'

interface CatalogEstablishmentProps {
  catalog: unknown
  city_slug: string | null
}

function statusClasses(detail: CatalogDetail): string {
  if (detail.businessStatus !== 'open') return 'bg-muted text-muted-foreground'
  return detail.isOpenNow
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
    : 'bg-muted text-muted-foreground'
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(dateOnly ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date)
}

function formatAttribute(attribute: CatalogAttribute): string {
  if (attribute.options.length > 0)
    return attribute.options.map((option) => option.label).join(', ')
  if (typeof attribute.value === 'boolean') return attribute.value ? 'Sim' : 'Não'
  if (attribute.value === null || attribute.value === '') return 'Não informado'
  return `${attribute.value}${attribute.unit ? ` ${attribute.unit}` : ''}`
}

function groupedHours(hours: CatalogHour[]): Array<{ weekday: number; intervals: CatalogHour[] }> {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    intervals: hours
      .filter((hour) => hour.weekday === weekday)
      .sort((left, right) => left.sortOrder - right.sortOrder),
  }))
}

function HistoricalEstablishment({ detail }: { detail: CatalogHistoricalDetail }) {
  return (
    <CatalogShell
      title={detail.name}
      description={detail.message}
      eyebrow="Referência histórica"
      citySlug={detail.city.slug}
      breadcrumbs={[
        { label: 'Cidades', href: '/cidades' },
        { label: detail.city.name, href: `/cidades/${encodeURIComponent(detail.city.slug)}` },
        { label: detail.name },
      ]}
    >
      <div className="mx-auto max-w-3xl rounded-3xl border bg-card p-7 shadow-sm sm:p-10">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CircleAlert className="size-5" />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Estabelecimento encerrado
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          Esta página permanece como referência
        </h2>
        <p className="mt-4 leading-7 text-muted-foreground">{detail.message}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Contatos e ações de conversão foram removidos. O catálogo exibe somente a informação
          histórica publicada.
        </p>
        <Link
          href={`/cidades/${encodeURIComponent(detail.city.slug)}`}
          className="mt-7 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          Voltar ao catálogo de {detail.city.name}
        </Link>
      </div>
    </CatalogShell>
  )
}

function PublishedEstablishment({ detail }: { detail: CatalogDetail }) {
  useEstablishmentViewAnalytics(detail)

  const addressLine = formatCatalogAddress(detail.address)
  const primaryCategory =
    detail.categories.find((category) => category.isPrimary) ?? detail.categories[0]
  const gallery = detail.media.filter((media) => media.url !== detail.cover?.url).slice(0, 6)
  const schedule = groupedHours(detail.weeklyHours)
  const publishedAt = formatDate(detail.publishedAt)
  const updatedAt = formatDate(detail.updatedAt)
  const locationLabel = [detail.city.name, detail.city.stateCode].filter(Boolean).join(' — ')

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': detail.name,
    'description': detail.shortDescription ?? detail.description ?? undefined,
    'image': detail.media.map((media) => media.url),
    'telephone': detail.contacts.phone ?? undefined,
    'email': detail.contacts.email ?? undefined,
    'url': detail.contacts.website ?? undefined,
    'address': addressLine
      ? {
          '@type': 'PostalAddress',
          'streetAddress': [
            detail.address.street,
            detail.address.withoutNumber ? 's/n' : detail.address.number,
          ]
            .filter(Boolean)
            .join(', '),
          'addressLocality': detail.city.name,
          'addressRegion': detail.city.stateCode ?? undefined,
          'postalCode': detail.address.postalCode ?? undefined,
          'addressCountry': 'BR',
        }
      : undefined,
    'geo':
      detail.address.latitude !== null && detail.address.longitude !== null
        ? {
            '@type': 'GeoCoordinates',
            'latitude': detail.address.latitude,
            'longitude': detail.address.longitude,
          }
        : undefined,
  }
  const serializedStructuredData = JSON.stringify(structuredData).replace(/</g, '\\u003c')

  return (
    <CatalogShell
      title={detail.name}
      description={
        detail.shortDescription ??
        detail.description ??
        `Informações públicas de ${detail.name} em ${detail.city.name}.`
      }
      eyebrow={primaryCategory?.name ?? 'Estabelecimento local'}
      citySlug={detail.city.slug}
      image={detail.cover?.url}
      breadcrumbs={[
        { label: 'Cidades', href: '/cidades' },
        { label: detail.city.name, href: `/cidades/${encodeURIComponent(detail.city.slug)}` },
        ...(primaryCategory
          ? [
              {
                label: primaryCategory.name,
                href: `/cidades/${encodeURIComponent(detail.city.slug)}/categorias/${encodeURIComponent(primaryCategory.slug)}`,
              },
            ]
          : []),
        { label: detail.name },
      ]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializedStructuredData }}
      />

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-7">
          <section
            aria-label="Apresentação do estabelecimento"
            className="overflow-hidden rounded-3xl border bg-card shadow-sm"
          >
            <div className="relative overflow-hidden">
              {detail.cover ? (
                <img
                  src={detail.cover.url}
                  alt={detail.cover.altText}
                  width={detail.cover.width ?? undefined}
                  height={detail.cover.height ?? undefined}
                  decoding="async"
                  className="max-h-[640px] min-h-64 w-full object-cover sm:min-h-96"
                />
              ) : (
                <div className="relative flex min-h-72 items-center justify-center bg-gradient-to-br from-primary/12 via-accent to-warning/15 text-muted-foreground sm:min-h-96">
                  <div className="absolute inset-0 bg-grid-pattern opacity-25" />
                  <ImageIcon className="relative size-10" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-5 text-white sm:p-7">
                <div className="min-w-0">
                  {detail.isSponsored ? (
                    <Badge variant="primary" className="mb-3 gap-1 rounded-full shadow-sm">
                      <Sparkles className="size-3" /> Destaque
                    </Badge>
                  ) : null}
                  <p className="flex items-center gap-1.5 text-sm text-white/85">
                    <MapPin className="size-4 shrink-0" /> {locationLabel}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm',
                    statusClasses(detail)
                  )}
                >
                  {businessStatusLabel(detail.businessStatus, detail.isOpenNow)}
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap gap-2">
                {detail.categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/cidades/${encodeURIComponent(detail.city.slug)}/categorias/${encodeURIComponent(category.slug)}`}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      category.isPrimary
                        ? 'bg-accent text-accent-foreground hover:bg-accent/75'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>

              {detail.shortDescription ? (
                <p className="mt-5 text-lg font-medium leading-7 text-foreground/85">
                  {detail.shortDescription}
                </p>
              ) : null}
              {detail.description ? (
                <p className="mt-4 whitespace-pre-line leading-7 text-muted-foreground">
                  {detail.description}
                </p>
              ) : null}
            </div>
          </section>

          {gallery.length > 0 ? (
            <section
              aria-labelledby="gallery-title"
              className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                  Galeria
                </p>
                <h2 id="gallery-title" className="mt-1 text-xl font-semibold">
                  Veja o espaço
                </h2>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {gallery.map((media) => (
                  <figure
                    key={media.url}
                    className="min-w-0 overflow-hidden rounded-xl border bg-muted"
                  >
                    <img
                      src={media.url}
                      alt={media.altText}
                      width={media.width ?? undefined}
                      height={media.height ?? undefined}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/3] w-full object-cover transition duration-300 hover:scale-[1.025]"
                    />
                    {media.caption ? (
                      <figcaption className="px-3 py-2 text-xs leading-5 text-muted-foreground">
                        {media.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          {detail.attributes.length > 0 ? (
            <section
              aria-labelledby="attributes-title"
              className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                  Características
                </p>
                <h2 id="attributes-title" className="mt-1 text-xl font-semibold">
                  Informações úteis
                </h2>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {detail.attributes.map((attribute) => (
                  <div key={attribute.key} className="rounded-xl border bg-background p-4">
                    <dt className="text-sm font-medium">{attribute.name}</dt>
                    <dd className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {formatAttribute(attribute)}
                    </dd>
                    {attribute.description ? (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {attribute.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {detail.businessStatus === 'open' ? (
            <section
              aria-labelledby="hours-title"
              className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                    Atendimento
                  </p>
                  <h2 id="hours-title" className="mt-1 text-xl font-semibold">
                    Horários
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock3 className="size-4" /> {availabilityLabel(detail.availabilityType)}
                </span>
              </div>

              {detail.availabilityType === 'regular_hours' ? (
                <div className="mt-5 divide-y rounded-xl border bg-background px-4">
                  {schedule.map(({ weekday, intervals }) => (
                    <div
                      key={weekday}
                      className="grid gap-1 py-3 text-sm sm:grid-cols-[9rem_1fr] sm:gap-4"
                    >
                      <span className="font-medium">{weekdayLabel(weekday)}</span>
                      <span className="text-muted-foreground sm:text-end">
                        {intervals.length === 0
                          ? 'Fechado'
                          : intervals
                              .map(
                                (interval) =>
                                  `${interval.opensAt}–${interval.closesAt}${interval.spansNextDay ? ' (+1 dia)' : ''}`
                              )
                              .join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 flex items-start gap-3 rounded-xl border bg-accent/60 p-4 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="leading-6 text-muted-foreground">
                    {detail.availabilityType === 'always_open'
                      ? 'Este estabelecimento informa atendimento contínuo, 24 horas por dia.'
                      : 'O atendimento acontece mediante agendamento. Use os contatos disponíveis para combinar.'}
                  </p>
                </div>
              )}

              {detail.specialDays.length > 0 ? (
                <div className="mt-6">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarClock className="size-4 text-primary" /> Datas especiais
                  </h3>
                  <div className="mt-3 grid gap-2">
                    {detail.specialDays.map((day) => (
                      <div
                        key={day.date}
                        className="flex flex-col gap-1 rounded-xl border bg-background px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-medium">{formatDate(day.date) ?? day.date}</span>
                        <span className="text-muted-foreground">
                          {day.status === 'closed'
                            ? 'Fechado'
                            : day.intervals
                                .map((interval) => `${interval.opensAt}–${interval.closesAt}`)
                                .join(' · ')}
                          {day.note ? ` — ${day.note}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="rounded-2xl border bg-muted/45 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <h2 className="font-semibold">Atendimento indisponível</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {detail.businessStatus === 'temporarily_closed'
                      ? 'O estabelecimento informou fechamento temporário. Consulte novamente mais tarde.'
                      : 'Este estabelecimento encerrou as atividades.'}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24">
          {addressLine || detail.address.postalCode ? (
            <section
              aria-labelledby="address-title"
              className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <MapPin className="size-4" />
              </span>
              <h2 id="address-title" className="mt-4 text-lg font-semibold">
                Endereço
              </h2>
              {addressLine ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{addressLine}</p>
              ) : null}
              <p className="mt-1 text-sm text-muted-foreground">{locationLabel}</p>
              {detail.address.complement ? (
                <p className="mt-1 text-sm text-muted-foreground">{detail.address.complement}</p>
              ) : null}
              {detail.address.reference ? (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Referência: {detail.address.reference}
                </p>
              ) : null}
              {detail.address.postalCode ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  CEP {detail.address.postalCode}
                </p>
              ) : null}
            </section>
          ) : null}

          <EstablishmentActions detail={detail} />

          <section
            aria-labelledby="publication-title"
            className="rounded-2xl border bg-card p-5 text-sm shadow-sm sm:p-6"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Check className="size-4" />
            </span>
            <h2 id="publication-title" className="mt-4 font-semibold">
              Conteúdo publicado
            </h2>
            <p className="mt-2 leading-6 text-muted-foreground">
              Esta ficha usa apenas dados aprovados e publicados pela operação regional.
            </p>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              {publishedAt ? <p>Publicado em {publishedAt}</p> : null}
              {updatedAt ? <p>Atualizado em {updatedAt}</p> : null}
            </div>
          </section>

          <Link
            href={`/cidades/${encodeURIComponent(detail.city.slug)}`}
            className="inline-flex items-center gap-2 px-1 text-sm font-semibold text-primary hover:underline"
          >
            <Building2 className="size-4" /> Ver mais lugares em {detail.city.name}
          </Link>
        </aside>
      </div>
    </CatalogShell>
  )
}

export default function CatalogEstablishment({ catalog }: CatalogEstablishmentProps) {
  const detail = catalogDetail(catalog)

  if (!detail) {
    return (
      <CatalogShell
        title="Estabelecimento indisponível"
        description="A ficha pública não pôde ser carregada."
        breadcrumbs={[{ label: 'Cidades', href: '/cidades' }, { label: 'Indisponível' }]}
      >
        <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
          <CircleAlert className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Não foi possível exibir esta ficha</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            O conteúdo pode ter sido removido, ainda não estar publicado ou estar temporariamente
            indisponível.
          </p>
          <Link
            href="/cidades"
            className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline"
          >
            Explorar outras cidades
          </Link>
        </div>
      </CatalogShell>
    )
  }

  return detail.historical ? (
    <HistoricalEstablishment detail={detail} />
  ) : (
    <PublishedEstablishment detail={detail} />
  )
}
