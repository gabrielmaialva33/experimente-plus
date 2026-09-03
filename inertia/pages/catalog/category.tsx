import { CatalogPagination } from '~/components/catalog/catalog_pagination'
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

      {result.sponsored.length > 0 ? (
        <section
          aria-labelledby="category-sponsored"
          aria-describedby="category-sponsored-description"
          className="mt-8"
        >
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Patrocinado
            </p>
            <h2 id="category-sponsored" className="mt-1 text-xl font-semibold">
              Anúncios nesta categoria
            </h2>
            <p id="category-sponsored-description" className="mt-1 text-sm text-muted-foreground">
              Estes estabelecimentos pagaram por esta posição. Isso não representa uma avaliação de
              qualidade.
            </p>
          </div>
          <EstablishmentGrid entries={result.sponsored} citySlug={resolvedCitySlug} sponsored />
        </section>
      ) : null}

      <section aria-labelledby="category-results" className="mt-8">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Catálogo publicado
          </p>
          <h2 id="category-results" className="mt-1 text-xl font-semibold">
            {result.query.q ? `Resultados para “${result.query.q}”` : `Opções de ${categoryName}`}
          </h2>
        </div>
        <EstablishmentGrid
          entries={result.organic}
          citySlug={resolvedCitySlug}
          emptyTitle={
            hasSponsoredResults ? 'Nenhuma outra opção encontrada' : 'Nenhuma opção encontrada'
          }
          emptyMessage={
            hasSponsoredResults
              ? 'Os anúncios patrocinados acima são exibidos separadamente e não entram na paginação do catálogo.'
              : 'Ainda não há estabelecimentos nesta categoria com os filtros escolhidos.'
          }
        />
      </section>

      <CatalogPagination path={pagePath} query={paginationQuery} meta={result.meta} />
    </CatalogShell>
  )
}
