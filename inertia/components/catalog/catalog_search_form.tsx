import { Link, router } from '@inertiajs/react'
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import type { CatalogCategory, CatalogSearchQuery } from '~/lib/catalog'
import { cn } from '~/lib/utils'

interface CatalogSearchFormProps {
  path: string
  query: CatalogSearchQuery
  total: number
  perPage: number
  sponsoredCount?: number
  categories?: CatalogCategory[]
  categoryLabel?: string | null
  includeCategoryParam?: boolean
}

export function CatalogSearchForm({
  path,
  query,
  total,
  perPage,
  sponsoredCount = 0,
  categories = [],
  categoryLabel = null,
  includeCategoryParam = true,
}: CatalogSearchFormProps) {
  const showCategoryFilter = includeCategoryParam && categories.length > 0
  const selectedCategory = categories.find((category) => category.slug === query.category)
  const effectiveCategoryLabel = categoryLabel ?? selectedCategory?.name ?? null
  const [search, setSearch] = useState(query.q)
  const [category, setCategory] = useState(query.category ?? '')
  const [sort, setSort] = useState(query.sort)
  const [openNow, setOpenNow] = useState(query.openNow)
  const [isNavigating, setIsNavigating] = useState(false)
  const hasActiveFilters = Boolean(
    query.q ||
    query.openNow ||
    query.sort !== 'relevance' ||
    (includeCategoryParam && query.category)
  )

  useEffect(() => {
    setSearch(query.q)
    setCategory(query.category ?? '')
    setSort(query.sort)
    setOpenNow(query.openNow)
    setIsNavigating(false)
  }, [query.category, query.openNow, query.q, query.sort])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parameters: Record<string, string> = { per_page: String(perPage) }
    const normalizedSearch = search.trim()

    if (normalizedSearch) parameters.q = normalizedSearch
    if (includeCategoryParam && category) parameters.category = category
    if (sort !== 'relevance') parameters.sort = sort
    if (openNow) parameters.open_now = 'true'

    setIsNavigating(true)
    router.get(path, parameters, {
      preserveState: true,
      replace: true,
      onFinish: () => setIsNavigating(false),
    })
  }

  return (
    <section
      aria-labelledby="catalog-search-title"
      className="rounded-lg border bg-card p-4 sm:p-5"
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <SlidersHorizontal aria-hidden="true" className="size-3.5" /> Busca e filtros
          </p>
          <h2 id="catalog-search-title" className="mt-1.5 text-lg font-semibold">
            Encontre um lugar
          </h2>
        </div>
        <p
          id="catalog-results-summary"
          className="text-sm text-muted-foreground"
          aria-live="polite"
        >
          {total} {total === 1 ? 'resultado no catálogo' : 'resultados no catálogo'}
          {sponsoredCount > 0
            ? ` · ${sponsoredCount} ${sponsoredCount === 1 ? 'anúncio patrocinado' : 'anúncios patrocinados'}`
            : ''}
        </p>
      </div>

      <form
        action={path}
        method="get"
        role="search"
        aria-busy={isNavigating}
        aria-describedby="catalog-results-summary"
        onSubmit={submitSearch}
        className={cn(
          'grid items-end gap-4',
          showCategoryFilter
            ? 'md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,14rem)_11rem_auto_auto]'
            : 'md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_auto_auto]'
        )}
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">O que você procura?</span>
          <span className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              name="q"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={120}
              placeholder="Ex.: café, cinema ou tatuagem"
              autoComplete="off"
              className="h-11 ps-10"
            />
          </span>
        </label>

        {showCategoryFilter ? (
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Categoria</span>
            <select
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name} ({category.establishmentsCount})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Ordenar por</span>
          <select
            name="sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as CatalogSearchQuery['sort'])}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="relevance">Mais relevantes</option>
            <option value="name">Ordem alfabética</option>
            <option value="recent">Publicados recentemente</option>
          </select>
        </label>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Disponibilidade</span>
          <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-md border border-input bg-background px-3 text-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
            <input
              type="checkbox"
              name="open_now"
              value="true"
              checked={openNow}
              onChange={(event) => setOpenNow(event.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Aberto agora
          </label>
        </div>

        <input type="hidden" name="per_page" value={perPage} />

        <Button
          type="submit"
          variant="cta"
          size="lg"
          className="h-11 w-full lg:w-auto"
          disabled={isNavigating}
          aria-busy={isNavigating}
        >
          <Search aria-hidden="true" className="size-4" />
          {isNavigating ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>

      {effectiveCategoryLabel || hasActiveFilters ? (
        <div
          aria-label="Filtros aplicados"
          className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4 text-xs"
        >
          {effectiveCategoryLabel ? (
            <span className="rounded-md border border-primary/20 bg-primary-soft px-2.5 py-1.5 font-medium text-primary-accent">
              Categoria: {effectiveCategoryLabel}
            </span>
          ) : null}
          {query.q ? (
            <span className="rounded-md border bg-muted px-2.5 py-1.5 text-muted-foreground">
              Busca: “{query.q}”
            </span>
          ) : null}
          {query.openNow ? (
            <span className="rounded-md border bg-muted px-2.5 py-1.5 text-muted-foreground">
              Aberto agora
            </span>
          ) : null}
          {query.sort !== 'relevance' ? (
            <span className="rounded-md border bg-muted px-2.5 py-1.5 text-muted-foreground">
              Ordenação: {query.sort === 'name' ? 'alfabética' : 'mais recentes'}
            </span>
          ) : null}
          {hasActiveFilters ? (
            <Link
              href={path}
              className="ms-auto inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold text-primary outline-none hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" /> Limpar filtros
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
