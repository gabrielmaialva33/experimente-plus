import { Link } from '@inertiajs/react'

import { booleanValue, coverUrl, stringValue, type JsonRecord } from '../../lib/catalog'

interface EstablishmentGridProps {
  entries: JsonRecord[]
  citySlug: string
  emptyMessage?: string
}

export default function EstablishmentGrid({
  entries,
  citySlug,
  emptyMessage = 'Nenhum estabelecimento publicado foi encontrado com esses filtros.',
}: EstablishmentGridProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <h2 className="text-lg font-semibold">Nada por aqui ainda</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {emptyMessage}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry, index) => {
        const slug = stringValue(entry, 'slug', 'establishment_slug') ?? `item-${index}`
        const name = stringValue(entry, 'public_name', 'name') ?? 'Estabelecimento'
        const description = stringValue(entry, 'short_description', 'description')
        const category = stringValue(entry, 'primary_category_name', 'category_name')
        const image = coverUrl(entry)
        const openNow = booleanValue(entry, 'open_now', 'is_open_now')
        const temporarilyClosed = booleanValue(entry, 'temporarily_closed') === true
        const permanentlyClosed = booleanValue(entry, 'permanently_closed') === true

        return (
          <article
            key={`${slug}-${index}`}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            {image ? (
              <img src={image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-muted text-sm text-muted-foreground">
                Imagem em preparação
              </div>
            )}

            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                {category ? (
                  <span className="rounded-full bg-muted px-2.5 py-1">{category}</span>
                ) : null}
                {permanentlyClosed ? (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    Encerrado
                  </span>
                ) : temporarilyClosed ? (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    Fechado temporariamente
                  </span>
                ) : openNow === true ? (
                  <span className="rounded-full bg-muted px-2.5 py-1">Aberto agora</span>
                ) : openNow === false ? (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    Fechado agora
                  </span>
                ) : null}
              </div>

              <h2 className="mt-4 text-xl font-semibold tracking-tight">{name}</h2>
              {description ? (
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              ) : null}

              <Link
                href={`/cidades/${encodeURIComponent(citySlug)}/estabelecimentos/${encodeURIComponent(slug)}`}
                className="mt-5 inline-flex text-sm font-semibold text-primary transition hover:opacity-80"
              >
                Ver detalhes
                <span aria-hidden="true" className="ml-1">
                  →
                </span>
              </Link>
            </div>
          </article>
        )
      })}
    </div>
  )
}
