import { CATALOG_RESULTS_ANCHOR, CatalogPagination } from '~/components/catalog/catalog_pagination'
import { CatalogSectionHeader } from '~/components/catalog/catalog_section_header'
import CatalogShell from '~/components/catalog/catalog_shell'
import { CatalogSearchForm } from '~/components/catalog/catalog_search_form'
import EstablishmentGrid from '~/components/catalog/establishment_grid'
import { useCatalogSearchAnalytics } from '~/components/catalog/use_catalog_analytics'
import { catalogSearch } from '~/lib/catalog'

interface CatalogCategoryProps {
  catalog: unknown
  city_slug: string
  category_slug: string
}

export default function CatalogCategory({ catalog }: CatalogCategoryProps) {
  const result = catalogSearch(catalog)
  const canonicalCity = result.context.city
  const canonicalCategory = result.context.category

  if (!canonicalCategory) {
    throw new TypeError('Catalog category page is missing its canonical category')
  }

  const resolvedCitySlug = canonicalCity.slug
  const resolvedCategorySlug = canonicalCategory.slug
  const cityName = canonicalCity.name
  const categoryName = canonicalCategory.name
  const hasSponsoredResults = result.sponsored.length > 0
  const pagePath = `/cidades/${encodeURIComponent(resolvedCitySlug)}/categorias/${encodeURIComponent(resolvedCategorySlug)}`
  const cityPath = `/cidades/${encodeURIComponent(resolvedCitySlug)}`
  const query = { ...result.query, category: resolvedCategorySlug }
  const paginationQuery = { ...query, category: null }

  useCatalogSearchAnalytics(resolvedCitySlug, { ...result, query })

  return (
    <CatalogShell
      title={`${categoryName} em ${cityName}`}
      description="Encontre opções locais publicadas nesta categoria e refine por nome, disponibilidade ou ordem de exibição."
      eyebrow="Descoberta por categoria"
      citySlug={resolvedCitySlug}
      activeSection="categories"
      breadcrumbs={[
        { label: 'Cidades', href: '/cidades' },
        { label: cityName, href: cityPath },
        { label: 'Categorias', href: `${cityPath}/categorias` },
        { label: categoryName },
      ]}
    >
      <CatalogSearchForm
        path={pagePath}
        query={query}
        total={result.meta.total}
        perPage={result.meta.perPage}
        sponsoredCount={result.sponsored.length}
        categoryLabel={categoryName}
        includeCategoryParam={false}
      />

      {/* A page change lands here, below the sticky header: see CatalogPagination. */}
      <div id={CATALOG_RESULTS_ANCHOR} className="scroll-mt-24">
        {result.sponsored.length > 0 ? (
          <section
            aria-labelledby="category-sponsored"
            aria-describedby="category-sponsored-description"
            className="mt-8"
          >
            <CatalogSectionHeader
              id="category-sponsored"
              overline="Patrocinado"
              title="Anúncios nesta categoria"
              descriptionId="category-sponsored-description"
              description="Estes lugares pagaram por esta posição. Isso não representa uma avaliação de qualidade."
            />
            <EstablishmentGrid entries={result.sponsored} citySlug={resolvedCitySlug} sponsored />
          </section>
        ) : null}

        <section aria-labelledby="category-results" className="mt-8">
          <CatalogSectionHeader
            id="category-results"
            overline="Catálogo publicado"
            title={
              result.query.q ? `Resultados para “${result.query.q}”` : `Opções de ${categoryName}`
            }
          />
          <EstablishmentGrid
            entries={result.organic}
            citySlug={resolvedCitySlug}
            emptyTitle={
              hasSponsoredResults ? 'Nenhuma outra opção encontrada' : 'Nenhuma opção encontrada'
            }
            emptyMessage={
              hasSponsoredResults
                ? 'Os anúncios patrocinados acima são exibidos separadamente e não entram na paginação do catálogo.'
                : 'Ainda não há lugares nesta categoria com os filtros escolhidos.'
            }
          />
        </section>
      </div>

      <CatalogPagination path={pagePath} query={paginationQuery} meta={result.meta} />
    </CatalogShell>
  )
}
