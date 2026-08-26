import { Link } from '@inertiajs/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '~/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from '~/components/ui/pagination'

/**
 * Builds an href for server-driven pagination/filters, dropping empty values
 * so cleared filters do not linger in the query string.
 */
export function buildPageHref(
  path: string,
  params: Record<string, string | number | null | undefined>
): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }

  const encoded = query.toString()
  return encoded ? `${path}?${encoded}` : path
}

interface PaginationNavProps {
  currentPage: number
  lastPage: number
  /** Maps a page number to its href, preserving the active filters. */
  buildHref: (page: number) => string
  label?: string
  className?: string
}

function visiblePages(currentPage: number, lastPage: number): number[] {
  const pages = new Set<number>([1, lastPage, currentPage - 1, currentPage, currentPage + 1])
  return [...pages]
    .filter((page) => page >= 1 && page <= lastPage)
    .sort((left, right) => left - right)
}

/**
 * Server-driven pagination over the Lucid paginator meta. Every page is a real
 * link so items beyond page 1 stay reachable by keyboard and without JS state.
 */
export function PaginationNav({
  currentPage,
  lastPage,
  buildHref,
  label = 'Paginação',
  className,
}: PaginationNavProps) {
  if (lastPage <= 1) return null

  const pages = visiblePages(currentPage, lastPage)
  const items: Array<{ key: string; page?: number }> = []

  pages.forEach((page, index) => {
    const previous = pages[index - 1]
    if (previous !== undefined && page - previous > 1) {
      items.push({ key: `ellipsis-${page}` })
    }
    items.push({ key: `page-${page}`, page })
  })

  return (
    <Pagination aria-label={label} className={className}>
      <PaginationContent>
        <PaginationItem>
          {currentPage > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref(currentPage - 1)}>
                <ChevronLeft aria-hidden="true" className="size-4" />
                <span className="sr-only sm:not-sr-only">Anterior</span>
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft aria-hidden="true" className="size-4" />
              <span className="sr-only sm:not-sr-only">Anterior</span>
            </Button>
          )}
        </PaginationItem>

        {items.map((item) =>
          item.page === undefined ? (
            <PaginationItem key={item.key}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item.key}>
              <Button asChild variant={item.page === currentPage ? 'primary' : 'outline'} size="sm">
                <Link
                  href={buildHref(item.page)}
                  aria-current={item.page === currentPage ? 'page' : undefined}
                  aria-label={`Página ${item.page}`}
                >
                  {item.page}
                </Link>
              </Button>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          {currentPage < lastPage ? (
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref(currentPage + 1)}>
                <span className="sr-only sm:not-sr-only">Próxima</span>
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <span className="sr-only sm:not-sr-only">Próxima</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
