import { Link } from '@inertiajs/react'
import { MapPin, SearchX } from 'lucide-react'

import { CatalogImageFallback } from '~/components/catalog/catalog_image_fallback'
import { EstablishmentStatus } from '~/components/catalog/establishment_status'
import { EmptyState } from '~/components/empty_state'
import { Badge } from '~/components/ui/badge'
import type { CatalogSearchItem } from '~/lib/catalog'

interface EstablishmentGridProps {
  entries: CatalogSearchItem[]
  citySlug: string
  emptyTitle?: string
  emptyMessage?: string
  sponsored?: boolean
}

export default function EstablishmentGrid({
  entries,
  citySlug,
  emptyTitle = 'Nada por aqui ainda',
  emptyMessage = 'Nenhum lugar publicado foi encontrado com esses filtros.',
  sponsored = false,
}: EstablishmentGridProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-card border border-dashed bg-card">
        <EmptyState title={emptyTitle} description={emptyMessage} icon={SearchX} />
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const resolvedCitySlug = citySlug || entry.citySlug
        const href = `/cidades/${encodeURIComponent(resolvedCitySlug)}/estabelecimentos/${encodeURIComponent(entry.slug)}`
        const paidPlacement = sponsored || entry.isSponsored
        const titleId = `establishment-${paidPlacement ? 'sponsored' : 'organic'}-${entry.slug}`
        const statusId = `${titleId}-status`
        const sponsorshipId = `${titleId}-sponsorship`
        const location = [entry.district, entry.cityName || null, entry.stateCode]
          .filter(Boolean)
          .join(' · ')

        return (
          <Link
            key={entry.slug}
            href={href}
            aria-labelledby={titleId}
            aria-describedby={`${paidPlacement ? `${sponsorshipId} ` : ''}${statusId}`}
            className="group block min-w-0 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {/* Direction A's place card: the photo leads and carries the state. */}
            <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-border-subtle bg-card transition-colors group-hover:border-primary motion-reduce:transition-none">
              <div className="relative">
                {entry.cover ? (
                  <img
                    src={entry.cover.url}
                    alt={entry.cover.altText || `Imagem de ${entry.name}`}
                    width={entry.cover.width ?? undefined}
                    height={entry.cover.height ?? undefined}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : (
                  <CatalogImageFallback
                    name={entry.name}
                    categoryName={entry.primaryCategory?.name}
                    className="aspect-[16/9] w-full"
                  />
                )}
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  {paidPlacement && (
                    <Badge id={sponsorshipId} variant="secondary" shape="pill">
                      Patrocinado
                    </Badge>
                  )}
                  <EstablishmentStatus
                    id={statusId}
                    businessStatus={entry.businessStatus}
                    isOpenNow={entry.isOpenNow}
                  />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                {entry.primaryCategory ? (
                  <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
                    {entry.primaryCategory.name}
                  </p>
                ) : null}

                <h3
                  id={titleId}
                  className="mt-1 font-display text-[1.1875rem] font-extrabold leading-tight tracking-[-0.01em] underline-offset-4 group-hover:underline"
                >
                  {entry.name}
                </h3>

                {location ? (
                  <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin aria-hidden="true" className="size-4 shrink-0" />
                    <span className="truncate">{location}</span>
                  </p>
                ) : null}

                {entry.shortDescription ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {entry.shortDescription}
                  </p>
                ) : null}
              </div>
            </article>
          </Link>
        )
      })}
    </div>
  )
}
