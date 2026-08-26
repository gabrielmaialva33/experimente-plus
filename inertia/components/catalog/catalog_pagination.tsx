import { Link } from '@inertiajs/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '~/lib/utils'
import { pageHref, type CatalogSearchMeta, type CatalogSearchQuery } from '~/lib/catalog'

interface CatalogPaginationProps {
  path: string
  query: CatalogSearchQuery
  meta: CatalogSearchMeta
}

function visiblePages(current: number, last: number): number[] {
  const start = Math.max(1, Math.min(current - 2, last - 4))
  const end = Math.min(last, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

const directionClassName =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
const pageClassName =
  'inline-flex size-11 items-center justify-center rounded-lg border text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function CatalogPagination({ path, query, meta }: CatalogPaginationProps) {
  if (meta.lastPage <= 1) return null

  const pages = visiblePages(meta.page, meta.lastPage)
  const previousAvailable = meta.page > 1
  const nextAvailable = meta.page < meta.lastPage

  return (
    <nav
      aria-label="Paginação dos resultados"
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
    >
      {previousAvailable ? (
        <Link
          href={pageHref(path, query, meta.page - 1, meta.perPage)}
          preserveScroll
          aria-label="Página anterior"
          className={cn(directionClassName, 'hover:border-primary/40 hover:text-primary')}
        >
          <ChevronLeft aria-hidden="true" className="size-4" /> Anterior
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(directionClassName, 'cursor-not-allowed opacity-45')}
        >
          <ChevronLeft aria-hidden="true" className="size-4" /> Anterior
        </span>
      )}

      {pages[0] > 1 ? (
        <span aria-hidden="true" className="px-1 text-muted-foreground">
          …
        </span>
      ) : null}

      {pages.map((page) =>
        page === meta.page ? (
          <span
            key={page}
            aria-current="page"
            aria-label={`Página ${page}, página atual`}
            className={cn(pageClassName, 'border-primary bg-primary text-primary-foreground')}
          >
            {page}
          </span>
        ) : (
          <Link
            key={page}
            href={pageHref(path, query, page, meta.perPage)}
            preserveScroll
            aria-label={`Ir para a página ${page}`}
            className={cn(pageClassName, 'bg-card hover:border-primary/40 hover:text-primary')}
          >
            {page}
          </Link>
        )
      )}

      {pages.at(-1)! < meta.lastPage ? (
        <span aria-hidden="true" className="px-1 text-muted-foreground">
          …
        </span>
      ) : null}

      {nextAvailable ? (
        <Link
          href={pageHref(path, query, meta.page + 1, meta.perPage)}
          preserveScroll
          aria-label="Próxima página"
          className={cn(directionClassName, 'hover:border-primary/40 hover:text-primary')}
        >
          Próxima <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(directionClassName, 'cursor-not-allowed opacity-45')}
        >
          Próxima <ChevronRight aria-hidden="true" className="size-4" />
        </span>
      )}
    </nav>
  )
}
