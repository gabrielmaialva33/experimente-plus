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
  'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border bg-card px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none sm:flex-none'
const pageClassName =
  'inline-flex size-10 items-center justify-center rounded-md border text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none'

export function CatalogPagination({ path, query, meta }: CatalogPaginationProps) {
  if (meta.lastPage <= 1) return null

  const pages = visiblePages(meta.page, meta.lastPage)
  const previousAvailable = meta.page > 1
  const nextAvailable = meta.page < meta.lastPage

  return (
    <nav
      aria-label="Paginação dos resultados"
      className="mt-8 flex items-center justify-between gap-2 sm:justify-center"
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

      <p className="shrink-0 text-sm text-muted-foreground sm:hidden" aria-live="polite">
        Página <span className="font-semibold text-foreground">{meta.page}</span> de {meta.lastPage}
      </p>

      <div className="hidden items-center gap-2 sm:flex">
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
      </div>

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
