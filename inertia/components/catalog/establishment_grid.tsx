import { Link } from '@inertiajs/react'
import { ArrowUpRight, ImageIcon, MapPin, Sparkles } from 'lucide-react'

import { CatalogImageFallback } from '~/components/catalog/catalog_image_fallback'
import { Badge } from '~/components/ui/badge'
import {
  businessStatusLabel,
  type CatalogSearchItem,
  type CatalogBusinessStatus,
} from '~/lib/catalog'
import { cn } from '~/lib/utils'

interface EstablishmentGridProps {
  entries: CatalogSearchItem[]
  citySlug: string
  emptyTitle?: string
  emptyMessage?: string
  sponsored?: boolean
}

function statusClasses(status: CatalogBusinessStatus, openNow: boolean): string {
  if (status !== 'open') return 'bg-muted text-muted-foreground'
  return openNow
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
    : 'bg-muted text-muted-foreground'
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
      <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ImageIcon aria-hidden="true" className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">{emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {emptyMessage}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const resolvedCitySlug = citySlug || entry.citySlug
        const href = `/cidades/${encodeURIComponent(resolvedCitySlug)}/estabelecimentos/${encodeURIComponent(entry.slug)}`
        const status = businessStatusLabel(entry.businessStatus, entry.isOpenNow)
        const location = [entry.district, entry.cityName || null, entry.stateCode]
          .filter(Boolean)
          .join(' · ')

        return (
          <article
            key={entry.slug}
            className={cn(
              'group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg',
              sponsored && 'border-primary/25 bg-gradient-to-b from-primary/[0.045] to-card'
            )}
          >
            <Link
              href={href}
              aria-label={`Ver detalhes de ${entry.name}`}
              className="relative block overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              {entry.cover ? (
                <img
                  src={entry.cover.url}
                  alt={entry.cover.altText || `Imagem de ${entry.name}`}
                  width={entry.cover.width ?? undefined}
                  height={entry.cover.height ?? undefined}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                />
              ) : (
                <CatalogImageFallback
                  name={entry.name}
                  categoryName={entry.primaryCategory?.name}
                  className="aspect-[4/3] w-full"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
              <span
                className={cn(
                  'absolute bottom-3 start-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur',
                  statusClasses(entry.businessStatus, entry.isOpenNow)
                )}
              >
                {status}
              </span>
              {(sponsored || entry.isSponsored) && (
                <Badge
                  variant="primary"
                  className="absolute end-3 top-3 gap-1 rounded-full shadow-sm"
                >
                  <Sparkles aria-hidden="true" className="size-3" /> Destaque
                </Badge>
              )}
            </Link>

            <div className="flex flex-1 flex-col p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {entry.primaryCategory ? (
                  <span className="rounded-full bg-accent px-2.5 py-1 font-medium text-accent-foreground">
                    {entry.primaryCategory.name}
                  </span>
                ) : null}
              </div>

              <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">
                <Link
                  href={href}
                  className="outline-none hover:text-primary focus-visible:underline"
                >
                  {entry.name}
                </Link>
              </h3>

              {location ? (
                <p className="mt-2 flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span className="truncate">{location}</span>
                </p>
              ) : null}

              {entry.shortDescription ? (
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {entry.shortDescription}
                </p>
              ) : null}

              <Link
                href={href}
                className="mt-auto inline-flex items-center gap-1.5 rounded-sm pt-5 text-sm font-semibold text-primary outline-none transition hover:gap-2.5 focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ver detalhes <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </article>
        )
      })}
    </div>
  )
}
