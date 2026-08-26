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

export function CatalogPagination({ path, query, meta }: CatalogPaginationProps) {
  if (meta.lastPage <= 1) return null

  const pages = visiblePages(meta.page, meta.lastPage)

  return (
    <nav
      aria-label="Paginação dos resultados"
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
    >
      <Link
        href={pageHref(path, query, Math.max(1, meta.page - 1), meta.perPage)}
        preserveScroll
        aria-disabled={meta.page <= 1}
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium transition-colors',
          meta.page <= 1
            ? 'pointer-events-none opacity-45'
            : 'hover:border-primary/40 hover:text-primary'
        )}
      >
        <ChevronLeft className="size-4" /> Anterior
      </Link>

      {pages[0] > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
      {pages.map((page) => (
        <Link
          key={page}
          href={pageHref(path, query, page, meta.perPage)}
          preserveScroll
          aria-current={page === meta.page ? 'page' : undefined}
          className={cn(
            'inline-flex size-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors',
            page === meta.page
              ? 'border-primary bg-primary text-primary-foreground'
              : 'bg-card hover:border-primary/40 hover:text-primary'
          )}
        >
          {page}
        </Link>
      ))}
      {pages.at(-1)! < meta.lastPage ? <span className="px-1 text-muted-foreground">…</span> : null}

      <Link
        href={pageHref(path, query, Math.min(meta.lastPage, meta.page + 1), meta.perPage)}
        preserveScroll
        aria-disabled={meta.page >= meta.lastPage}
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium transition-colors',
          meta.page >= meta.lastPage
            ? 'pointer-events-none opacity-45'
            : 'hover:border-primary/40 hover:text-primary'
        )}
      >
        Próxima <ChevronRight className="size-4" />
      </Link>
    </nav>
  )
}
