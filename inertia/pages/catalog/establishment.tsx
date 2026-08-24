import { Link } from '@inertiajs/react'

import CatalogShell from '../../components/catalog/catalog_shell'
import {
  booleanValue,
  collection,
  coverUrl,
  firstRecord,
  recordValue,
  slugLabel,
  stringValue,
} from '../../lib/catalog'

interface CatalogEstablishmentProps {
  catalog: unknown
  city_slug: string | null
}

function phoneHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, '')}`
}

function whatsappHref(value: string): string {
  return `https://wa.me/${value.replace(/\D/g, '')}`
}

export default function CatalogEstablishment({
  catalog,
  city_slug: citySlug,
}: CatalogEstablishmentProps) {
  const establishment = firstRecord(catalog)
  const address = recordValue(establishment, 'address')
  const categories = collection(establishment?.categories)
  const hours = collection(establishment?.hours)
  const image = coverUrl(establishment)
  const name = stringValue(establishment, 'public_name', 'name') ?? 'Estabelecimento'
  const description =
    stringValue(establishment, 'description', 'short_description') ??
    'Informações públicas deste estabelecimento.'
  const shortDescription = stringValue(establishment, 'short_description')
  const resolvedCitySlug =
    citySlug ?? stringValue(establishment, 'city_slug') ?? stringValue(address, 'city_slug') ?? ''
  const cityName =
    stringValue(establishment, 'city_name') ??
    stringValue(address, 'city_name') ??
    slugLabel(resolvedCitySlug)
  const state =
    stringValue(establishment, 'state_code', 'uf') ?? stringValue(address, 'state_code', 'uf')
  const street = stringValue(address, 'street', 'street_name')
  const number = stringValue(address, 'number')
  const district = stringValue(address, 'district', 'neighborhood')
  const postalCode = stringValue(address, 'postal_code')
  const phone = stringValue(establishment, 'public_phone', 'phone')
  const whatsapp = stringValue(establishment, 'whatsapp')
  const website = stringValue(establishment, 'website')
  const instagram = stringValue(establishment, 'instagram')
  const openNow = booleanValue(establishment, 'open_now', 'is_open_now')
  const temporarilyClosed = booleanValue(establishment, 'temporarily_closed') === true
  const permanentlyClosed = booleanValue(establishment, 'permanently_closed') === true
  const cover = recordValue(establishment, 'cover', 'cover_image', 'media')
  const altText = stringValue(cover, 'alt_text') ?? name
  const primaryCategory =
    stringValue(establishment, 'primary_category_name', 'category_name') ??
    stringValue(categories[0] ?? null, 'name', 'category_name')

  const addressLine = [street, number, district, cityName, state].filter(Boolean).join(', ')
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name,
    'description': shortDescription ?? description,
    'image': image ?? undefined,
    'telephone': permanentlyClosed ? undefined : (phone ?? undefined),
    'url': permanentlyClosed ? undefined : (website ?? undefined),
    'address': addressLine
      ? {
          '@type': 'PostalAddress',
          'streetAddress': [street, number].filter(Boolean).join(', ') || undefined,
          'addressLocality': cityName || undefined,
          'addressRegion': state ?? undefined,
          'postalCode': postalCode ?? undefined,
          'addressCountry': 'BR',
        }
      : undefined,
  }
  const serializedStructuredData = JSON.stringify(structuredData).replace(/</g, '\\u003c')

  return (
    <CatalogShell
      title={name}
      description={shortDescription ?? description}
      eyebrow={primaryCategory ?? 'Estabelecimento local'}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializedStructuredData }}
      />

      <div className="mb-8">
        <Link
          href={resolvedCitySlug ? `/cidades/${encodeURIComponent(resolvedCitySlug)}` : '/cidades'}
          className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          ← Voltar ao catálogo {cityName ? `de ${cityName}` : ''}
        </Link>
      </div>

      {permanentlyClosed ? (
        <section className="rounded-2xl border border-border bg-muted/40 p-6">
          <p className="text-sm font-semibold">Estabelecimento encerrado</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Esta página permanece disponível apenas como referência histórica. Contatos e ações de
            conversão foram removidos.
          </p>
        </section>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
        <div className="space-y-8">
          {image ? (
            <img
              src={image}
              alt={altText}
              className="max-h-[620px] w-full rounded-3xl border border-border object-cover shadow-sm"
            />
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-3xl border border-dashed border-border bg-muted text-sm text-muted-foreground">
              Imagem em preparação
            </div>
          )}

          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              {primaryCategory ? (
                <span className="rounded-full bg-muted px-3 py-1">{primaryCategory}</span>
              ) : null}
              {temporarilyClosed ? (
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  Fechado temporariamente
                </span>
              ) : openNow === true ? (
                <span className="rounded-full bg-muted px-3 py-1">Aberto agora</span>
              ) : openNow === false ? (
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  Fechado agora
                </span>
              ) : null}
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">Sobre</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-muted-foreground">
              {description}
            </p>
          </section>

          {categories.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold">Categorias</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((category, index) => {
                  const label = stringValue(category, 'name', 'category_name')
                  const slug = stringValue(category, 'slug', 'category_slug')
                  if (!label) return null

                  return slug && resolvedCitySlug ? (
                    <Link
                      key={`${slug}-${index}`}
                      href={`/cidades/${encodeURIComponent(resolvedCitySlug)}/categorias/${encodeURIComponent(slug)}`}
                      className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium transition hover:bg-muted/70"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span
                      key={`${label}-${index}`}
                      className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium"
                    >
                      {label}
                    </span>
                  )
                })}
              </div>
            </section>
          ) : null}

          {hours.length > 0 && !permanentlyClosed ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold">Horários</h2>
              <div className="mt-4 divide-y divide-border">
                {hours.map((hour, index) => {
                  const day =
                    stringValue(hour, 'weekday_label', 'day_name', 'label') ?? `Dia ${index + 1}`
                  const opens = stringValue(hour, 'opens_at', 'opens')
                  const closes = stringValue(hour, 'closes_at', 'closes')
                  const closed = booleanValue(hour, 'closed', 'is_closed') === true

                  return (
                    <div
                      key={`${day}-${index}`}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <span className="font-medium">{day}</span>
                      <span className="text-muted-foreground">
                        {closed
                          ? 'Fechado'
                          : [opens, closes].filter(Boolean).join('–') ||
                            'Consulte o estabelecimento'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          {addressLine ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Endereço</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{addressLine}</p>
              {postalCode ? (
                <p className="mt-1 text-sm text-muted-foreground">CEP {postalCode}</p>
              ) : null}
            </section>
          ) : null}

          {!permanentlyClosed ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Entre em contato</h2>
              <div className="mt-4 grid gap-3">
                {whatsapp ? (
                  <a
                    href={whatsappHref(whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Chamar no WhatsApp
                  </a>
                ) : null}
                {phone ? (
                  <a
                    href={phoneHref(phone)}
                    className="rounded-xl border border-border px-4 py-3 text-center text-sm font-semibold transition hover:bg-muted"
                  >
                    Ligar para {phone}
                  </a>
                ) : null}
                {website ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-border px-4 py-3 text-center text-sm font-semibold transition hover:bg-muted"
                  >
                    Visitar site
                  </a>
                ) : null}
                {instagram ? (
                  <a
                    href={`https://instagram.com/${instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-border px-4 py-3 text-center text-sm font-semibold transition hover:bg-muted"
                  >
                    Ver Instagram
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </CatalogShell>
  )
}
