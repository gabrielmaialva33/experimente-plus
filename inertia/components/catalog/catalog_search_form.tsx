import { Link, router } from '@inertiajs/react'
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import type { NearbyCatalog } from '~/components/catalog/use_nearby_catalog'
import { AppliedFilterChip, FilterChip } from '~/components/ui/choice'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import type { CatalogCategory, CatalogSearchQuery, CatalogSort } from '~/lib/catalog'
import { nearbyFailureMessage } from '~/lib/catalog_nearby'
import { cn } from '~/lib/utils'

const SELECT_CLASS =
  'h-13 w-full appearance-none rounded-full border border-input bg-background ps-5 pe-11 text-[0.9375rem] text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30'

/** Native selects keep their semantics; only the arrow is drawn, to sit inside the pill. */
function SelectChevron() {
  return (
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
    />
  )
}

/** The orders, in the order the control offers them, with how a chip names each one. */
const SORT_OPTIONS: ReadonlyArray<{ value: CatalogSort; label: string; applied: string }> = [
  { value: 'relevance', label: 'Relevância', applied: 'relevância' },
  { value: 'rating', label: 'Mais bem avaliados', applied: 'mais bem avaliados' },
  { value: 'distance', label: 'Mais perto', applied: 'mais perto' },
  { value: 'price', label: 'Menor preço', applied: 'menor preço' },
  { value: 'name', label: 'Ordem alfabética', applied: 'alfabética' },
  { value: 'recent', label: 'Publicados recentemente', applied: 'mais recentes' },
]

export function appliedSortLabel(sort: CatalogSort): string {
  return SORT_OPTIONS.find((option) => option.value === sort)?.applied ?? 'relevância'
}

function nearbyMessage(nearby: NearbyCatalog | undefined): string {
  switch (nearby?.status) {
    case 'locating':
      return 'Pedindo sua localização ao navegador…'
    case 'located':
      return 'Localização pronta. Use Buscar para ver os lugares mais perto.'
    case 'loading':
      return 'Ordenando pelos lugares mais perto…'
    case 'ready':
      return 'Ordenado pelos mais perto de você. Sua localização não fica salva.'
    case 'failed':
      return nearbyFailureMessage(nearby.failure ?? 'error')
    default:
      return ''
  }
}

interface CatalogSearchFormProps {
  path: string
  query: CatalogSearchQuery
  total: number
  perPage: number
  sponsoredCount?: number
  categories?: CatalogCategory[]
  categoryLabel?: string | null
  includeCategoryParam?: boolean
  /**
   * "Mais perto". Without it the order is not offered: it needs the page to
   * show results that the API, not the page URL, answered.
   */
  nearby?: NearbyCatalog
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
  nearby,
}: CatalogSearchFormProps) {
  const showCategoryFilter = includeCategoryParam && categories.length > 0
  const selectedCategory = categories.find((category) => category.slug === query.category)
  const effectiveCategoryLabel = categoryLabel ?? selectedCategory?.name ?? null
  const [search, setSearch] = useState(query.q)
  const [category, setCategory] = useState(query.category ?? '')
  const [sort, setSort] = useState(query.sort)
  const [openNow, setOpenNow] = useState(query.openNow)
  const [benefitToday, setBenefitToday] = useState(query.benefitToday ?? false)
  const [isNavigating, setIsNavigating] = useState(false)
  const hasActiveFilters = Boolean(
    query.q ||
    query.openNow ||
    query.benefitToday ||
    query.sort !== 'relevance' ||
    (includeCategoryParam && query.category)
  )
  const sortOptions = nearby
    ? SORT_OPTIONS
    : SORT_OPTIONS.filter((option) => option.value !== 'distance')
  const nearbyStatus = nearbyMessage(nearby)
  const busy = isNavigating || nearby?.status === 'locating' || nearby?.status === 'loading'

  useEffect(() => {
    setSearch(query.q)
    setCategory(query.category ?? '')
    setSort(query.sort)
    setOpenNow(query.openNow)
    setBenefitToday(query.benefitToday ?? false)
    setIsNavigating(false)
  }, [query.benefitToday, query.category, query.openNow, query.q, query.sort])

  /**
   * "Mais perto" asks the browser for the position the moment it is picked, so
   * a refusal shows here, beside the choice, which then goes back to relevance.
   */
  function chooseSort(next: CatalogSort) {
    setSort(next)
    if (!nearby) return
    if (next === 'distance') {
      void nearby.locate().then((located) => {
        if (!located) setSort((current) => (current === 'distance' ? 'relevance' : current))
      })
    } else if (nearby.status !== 'ready') {
      // Picked and dropped before a search: the position goes with it.
      nearby.reset()
    }
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parameters: Record<string, string> = { per_page: String(perPage) }
    const normalizedSearch = search.trim()

    if (normalizedSearch) parameters.q = normalizedSearch
    if (includeCategoryParam && category) parameters.category = category
    if (openNow) parameters.open_now = 'true'
    if (benefitToday) parameters.benefit_today = 'true'

    if (sort === 'distance' && nearby) {
      const sorted = await nearby.search(
        {
          q: normalizedSearch,
          category: includeCategoryParam ? category || null : query.category,
          openNow,
          benefitToday,
        },
        perPage
      )
      if (sorted) return
      // The same filters in the default order; the message above says why.
      setSort('relevance')
    } else {
      if (sort !== 'relevance') parameters.sort = sort
      nearby?.reset()
    }

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
      className="rounded-card border border-border-subtle bg-card p-4 sm:p-6"
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
            <SlidersHorizontal aria-hidden="true" className="size-3.5" /> Busca e filtros
          </p>
          <h2
            id="catalog-search-title"
            className="mt-1 font-display text-[1.3125rem] font-extrabold leading-tight tracking-[-0.01em]"
          >
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
        aria-busy={busy}
        aria-describedby="catalog-results-summary"
        onSubmit={submitSearch}
        // One row only from 1280 px: at 1024 the four controls beside it left the search
        // field ~170 px, clipping its placeholder. Below that the search takes its own row
        // and the rest share the next rows, with Buscar closing the last one instead of
        // sitting alone or stretching across the card.
        className={cn(
          'grid items-end gap-4',
          showCategoryFilter
            ? 'md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(11rem,14rem)_11rem_auto_auto]'
            : 'md:grid-cols-[minmax(0,1fr)_auto_auto] xl:grid-cols-[minmax(0,1fr)_11rem_auto_auto]'
        )}
      >
        <label className="grid gap-1.5 md:col-span-full xl:col-span-1">
          <span className="text-sm font-medium">O que você procura?</span>
          <span className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              name="q"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={120}
              placeholder="Ex.: café, cinema ou tatuagem"
              autoComplete="off"
              className="h-13 rounded-full ps-12 pe-5 text-[0.9375rem]"
            />
          </span>
        </label>

        {showCategoryFilter ? (
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Categoria</span>
            <span className="relative block">
              <select
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Todas as categorias</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name} ({category.establishmentsCount})
                  </option>
                ))}
              </select>
              <SelectChevron />
            </span>
          </label>
        ) : null}

        <div className="grid gap-1.5">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Ordenar por</span>
            <span className="relative block">
              <select
                name="sort"
                value={sort}
                onChange={(event) => chooseSort(event.target.value as CatalogSort)}
                aria-describedby={sort === 'price' ? 'catalog-sort-price-hint' : undefined}
                className={SELECT_CLASS}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </span>
          </label>
          {/* Outside the label, so it describes the order instead of renaming the control. */}
          {sort === 'price' ? (
            <span id="catalog-sort-price-hint" className="text-xs text-muted-foreground">
              Pelo ticket médio informado pelo lugar; quem não informa aparece no fim.
            </span>
          ) : null}
        </div>

        <div role="group" aria-labelledby="catalog-availability-label" className="grid gap-1.5">
          <span id="catalog-availability-label" className="text-sm font-medium">
            Disponibilidade
          </span>
          <span className="flex min-h-13 flex-wrap items-center gap-2">
            <FilterChip
              name="open_now"
              value="true"
              checked={openNow}
              onChange={(event) => setOpenNow(event.target.checked)}
              className="h-13 px-5 text-[0.9375rem]"
            >
              Aberto agora
            </FilterChip>
            <FilterChip
              name="benefit_today"
              value="true"
              checked={benefitToday}
              onChange={(event) => setBenefitToday(event.target.checked)}
              className="h-13 px-5 text-[0.9375rem]"
            >
              Vale hoje
            </FilterChip>
          </span>
        </div>

        <input type="hidden" name="per_page" value={perPage} />

        <Button
          type="submit"
          variant="primary"
          size="2xl"
          shape="pill"
          className="w-full md:w-auto md:justify-self-end xl:justify-self-auto"
          disabled={busy}
          aria-busy={busy}
        >
          <Search aria-hidden="true" className="size-4" />
          {busy ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>

      {/* Present from the start, so a screen reader hears what "Mais perto" is doing. */}
      {nearby ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            'text-sm',
            nearbyStatus ? 'mt-4' : 'sr-only',
            nearby.status === 'failed' ? 'font-medium text-warning-accent' : 'text-muted-foreground'
          )}
        >
          {nearbyStatus}
        </p>
      ) : null}

      {effectiveCategoryLabel || hasActiveFilters ? (
        <div
          aria-label="Filtros aplicados"
          className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4 text-xs"
        >
          {effectiveCategoryLabel ? (
            <AppliedFilterChip>Categoria: {effectiveCategoryLabel}</AppliedFilterChip>
          ) : null}
          {query.q ? <AppliedFilterChip>Busca: “{query.q}”</AppliedFilterChip> : null}
          {query.openNow ? <AppliedFilterChip>Aberto agora</AppliedFilterChip> : null}
          {query.benefitToday ? <AppliedFilterChip>Vale hoje</AppliedFilterChip> : null}
          {query.sort !== 'relevance' ? (
            <AppliedFilterChip>Ordenação: {appliedSortLabel(query.sort)}</AppliedFilterChip>
          ) : null}
          {hasActiveFilters ? (
            <Link
              href={path}
              onClick={() => nearby?.reset()}
              className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary-accent outline-none hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" /> Limpar filtros
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
