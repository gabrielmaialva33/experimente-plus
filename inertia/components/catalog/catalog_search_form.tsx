import { Link } from '@inertiajs/react'
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import type { CatalogCategory, CatalogSearchQuery } from '~/lib/catalog'
import { cn } from '~/lib/utils'

interface CatalogSearchFormProps {
  path: string
  query: CatalogSearchQuery
  total: number
  perPage: number
  categories?: CatalogCategory[]
  categoryLabel?: string | null
  includeCategoryParam?: boolean
}

export function CatalogSearchForm({
  path,
  query,
  total,
  perPage,
  categories = [],
  categoryLabel = null,
  includeCategoryParam = true,
}: CatalogSearchFormProps) {
  const showCategoryFilter = includeCategoryParam && categories.length > 0
  const selectedCategory = categories.find((category) => category.slug === query.category)
  const effectiveCategoryLabel = categoryLabel ?? selectedCategory?.name ?? null
  const hasActiveFilters = Boolean(
    query.q ||
    query.openNow ||
    query.sort !== 'relevance' ||
    (includeCategoryParam && query.category)
  )

  return (
    <section
      aria-labelledby="catalog-search-title"
      className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            <SlidersHorizontal aria-hidden="true" className="size-3.5" /> Refine sua descoberta
          </p>
          <h2 id="catalog-search-title" className="mt-1.5 text-lg font-semibold">
            Buscar no catálogo
          </h2>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total} {total === 1 ? 'resultado publicado' : 'resultados publicados'}
        </p>
      </div>

      <form
        action={path}
        method="get"
        className={cn(
          'grid gap-3',
          showCategoryFilter
            ? 'lg:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_11rem_auto_auto]'
            : 'lg:grid-cols-[minmax(0,1fr)_11rem_auto_auto]'
        )}
      >
        <label className="relative block">
          <span className="sr-only">O que você procura?</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            name="q"
            defaultValue={query.q}
            maxLength={120}
            placeholder="Restaurante, café, cinema, serviço…"
            autoComplete="off"
            className="h-11 ps-10"
          />
        </label>

        {showCategoryFilter ? (
          <label className="block">
            <span className="sr-only">Filtrar por categoria</span>
            <select
              name="category"
              defaultValue={query.category ?? ''}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30"
            >
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name} ({category.establishmentsCount})
                </option>
              ))}
            </select>
          </label>
        ) : includeCategoryParam && query.category ? (
          <input type="hidden" name="category" value={query.category} />
        ) : null}

        <label className="block">
          <span className="sr-only">Ordenar resultados</span>
          <select
            name="sort"
            defaultValue={query.sort}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/30"
          >
            <option value="relevance">Mais relevantes</option>
            <option value="name">Ordem alfabética</option>
            <option value="recent">Publicados recentemente</option>
          </select>
        </label>

        <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs focus-within:ring-3 focus-within:ring-ring/30">
          <input
            type="checkbox"
            name="open_now"
            value="true"
            defaultChecked={query.openNow}
            className="size-4 rounded border-input text-primary accent-primary"
          />
          Aberto agora
        </label>

        <input type="hidden" name="per_page" value={perPage} />

        <Button type="submit" variant="cta" size="lg" className="h-11">
          <Search aria-hidden="true" className="size-4" /> Buscar
        </Button>
      </form>

      {effectiveCategoryLabel || hasActiveFilters ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4 text-xs">
          {effectiveCategoryLabel ? (
            <span className="rounded-full bg-accent px-3 py-1.5 font-medium text-accent-foreground">
              Categoria: {effectiveCategoryLabel}
            </span>
          ) : null}
          {query.q ? (
            <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
              Busca: “{query.q}”
            </span>
          ) : null}
          {query.openNow ? (
            <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
              Aberto agora
            </span>
          ) : null}
          {query.sort !== 'relevance' ? (
            <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
              Ordenação: {query.sort === 'name' ? 'alfabética' : 'mais recentes'}
            </span>
          ) : null}
          {hasActiveFilters ? (
            <Link
              href={path}
              className="ms-auto inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" /> Limpar filtros
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
