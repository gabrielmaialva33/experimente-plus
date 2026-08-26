import { CatalogPagination } from '~/components/catalog/catalog_pagination'
import CatalogShell from '~/components/catalog/catalog_shell'
import { CatalogSearchForm } from '~/components/catalog/catalog_search_form'
import EstablishmentGrid from '~/components/catalog/establishment_grid'
import { useCatalogSearchAnalytics } from '~/components/catalog/use_catalog_analytics'
import { catalogSearch, slugLabel } from '~/lib/catalog'

interface CatalogCategoryProps {
  catalog: unknown
  city_slug: string | null
  category_slug: string | null
}

export default function CatalogCategory({
  catalog,
  city_slug: citySlug,
  category_slug: categorySlug,
}: CatalogCategoryProps) {
  const result = catalogSearch(catalog)
  const firstItem = result.sponsored[0] ?? result.organic[0]
  const resolvedCitySlug = citySlug ?? firstItem?.citySlug ?? ''
  const resolvedCategorySlug = categorySlug ?? result.query.category ?? ''
  const cityName = firstItem?.cityName || slugLabel(resolvedCitySlug)
  const matchingCategory = firstItem?.categories.find(
    (category) => category.slug === resolvedCategorySlug
  )
  const categoryName =
    matchingCategory?.name ?? firstItem?.primaryCategory?.name ?? slugLabel(resolvedCategorySlug)
  const pagePath = `/cidades/${encodeURIComponent(resolvedCitySlug)}/categorias/${encodeURIComponent(resolvedCategorySlug)}`
  const cityPath = `/cidades/${encodeURIComponent(resolvedCitySlug)}`
  const query = { ...result.query, category: resolvedCategorySlug || null }

  useCatalogSearchAnalytics(resolvedCitySlug, { ...result, query })

  return (
    <CatalogShell
      title={`${categoryName || 'Categoria'} em ${cityName || 'sua cidade'}`}
      description="Encontre opções locais publicadas nesta categoria e refine por nome, disponibilidade ou ordem de exibição."
      eyebrow="Descoberta por categoria"
      citySlug={resolvedCitySlug}
      breadcrumbs={[
        { label: 'Cidades', href: '/cidades' },
        { label: cityName || 'Cidade', href: cityPath },
        { label: 'Categorias', href: `${cityPath}/categorias` },
        { label: categoryName || 'Categoria' },
      ]}
    >
      <CatalogSearchForm
        path={pagePath}
        query={query}
        total={result.meta.total}
        clearHref={pagePath}
        categoryLabel={categoryName}
        includeCategoryParam={false}
      />

      {result.sponsored.length > 0 ? (
        <section aria-labelledby="category-sponsored" className="mt-10">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Destaques
            </p>
            <h2 id="category-sponsored" className="mt-1 text-xl font-semibold">
              Em evidência nesta categoria
            </h2>
          </div>
          <EstablishmentGrid entries={result.sponsored} citySlug={resolvedCitySlug} sponsored />
        </section>
      ) : null}

      <section aria-labelledby="category-results" className="mt-10">
        <h2 id="category-results" className="mb-4 text-xl font-semibold">
          {result.query.q ? `Resultados para “${result.query.q}”` : `Opções de ${categoryName}`}
        </h2>
        <EstablishmentGrid
          entries={result.organic}
          citySlug={resolvedCitySlug}
          emptyTitle="Nenhuma opção encontrada"
          emptyMessage="Ainda não há estabelecimentos publicados nesta categoria com os filtros escolhidos."
        />
      </section>

      <CatalogPagination path={pagePath} query={query} meta={result.meta} />
    </CatalogShell>
  )
}
