import { Link } from '@inertiajs/react'
import { ArrowRight, ImageIcon, MapPin } from 'lucide-react'

import { CatalogImageFallback } from '~/components/catalog/catalog_image_fallback'
import { EmptyState } from '~/components/empty_state'
import { Badge } from '~/components/ui/badge'
import {
  businessStatusLabel,
  type CatalogSearchItem,
  type CatalogBusinessStatus,
} from '~/lib/catalog'

interface EstablishmentGridProps {
  entries: CatalogSearchItem[]
  citySlug: string
  emptyTitle?: string
  emptyMessage?: string
  sponsored?: boolean
}

function statusClasses(status: CatalogBusinessStatus, openNow: boolean): string {
  if (status !== 'open') return 'border-border bg-muted text-muted-foreground'
  return openNow
    ? 'border-success/25 bg-success-soft text-success-accent'
    : 'border-border bg-muted text-muted-foreground'
}

export default function EstablishmentGrid({
  entries,
  citySlug,
  emptyTitle = 'Nada por aqui ainda',
  emptyMessage = 'Nenhum estabelecimento publicado foi encontrado com esses filtros.',
  sponsored = false,
}: EstablishmentGridProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card">
        <EmptyState title={emptyTitle} description={emptyMessage} icon={ImageIcon} />
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const resolvedCitySlug = citySlug || entry.citySlug
        const href = `/cidades/${encodeURIComponent(resolvedCitySlug)}/estabelecimentos/${encodeURIComponent(entry.slug)}`
        const status = businessStatusLabel(entry.businessStatus, entry.isOpenNow)
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
            className="group block min-w-0 rounded-lg outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border bg-card transition-colors group-hover:border-primary/45 motion-reduce:transition-none">
              {entry.cover ? (
                <img
                  src={entry.cover.url}
                  alt={entry.cover.altText || `Imagem de ${entry.name}`}
                  width={entry.cover.width ?? undefined}
                  height={entry.cover.height ?? undefined}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full border-b object-cover"
                />
              ) : (
                <CatalogImageFallback
                  name={entry.name}
                  categoryName={entry.primaryCategory?.name}
                  className="aspect-[4/3] w-full border-b"
                />
              )}
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {paidPlacement && (
                    <Badge id={sponsorshipId} variant="secondary" appearance="outline" size="sm">
                      Patrocinado
                    </Badge>
                  )}
                  <Badge
                    id={statusId}
                    variant="outline"
                    size="sm"
                    className={statusClasses(entry.businessStatus, entry.isOpenNow)}
                  >
                    {status}
                  </Badge>
                </div>

                {entry.primaryCategory ? (
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                    {entry.primaryCategory.name}
                  </p>
                ) : null}

                <h3 id={titleId} className="mt-2 text-xl font-semibold tracking-tight">
                  {entry.name}
                </h3>

                {location ? (
                  <p className="mt-2 flex min-w-0 items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span className="truncate">{location}</span>
                  </p>
                ) : null}

                {entry.shortDescription ? (
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {entry.shortDescription}
                  </p>
                ) : null}

                <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-primary group-hover:underline group-hover:underline-offset-4">
                  Ver detalhes <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </div>
            </article>
          </Link>
        )
      })}
    </div>
  )
}
