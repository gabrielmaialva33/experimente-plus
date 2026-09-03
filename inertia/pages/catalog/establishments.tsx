import { CatalogPagination } from '~/components/catalog/catalog_pagination'
import CatalogShell from '~/components/catalog/catalog_shell'
import { CatalogSearchForm } from '~/components/catalog/catalog_search_form'
import EstablishmentGrid from '~/components/catalog/establishment_grid'
import { useCatalogSearchAnalytics } from '~/components/catalog/use_catalog_analytics'
import { catalogCategories, catalogSearch } from '~/lib/catalog'

interface CatalogEstablishmentsProps {
  catalog: unknown
  city_slug: string
  filter_categories: unknown
}

export default function CatalogEstablishments({
  catalog,
  filter_categories: filterCategories,
}: CatalogEstablishmentsProps) {
  const result = catalogSearch(catalog)
  const categoryListing = catalogCategories(filterCategories)
  const categories = categoryListing.categories
  const resolvedCitySlug = result.context.city.slug
  const cityName = result.context.city.name
  const hasSponsoredResults = result.sponsored.length > 0
  const pagePath = `/cidades/${encodeURIComponent(resolvedCitySlug)}`

  useCatalogSearchAnalytics(resolvedCitySlug, result)

  return (
    <CatalogShell
      title={`O que conhecer em ${cityName}`}
      description="Busque lugares e serviços locais publicados, com categorias, endereço, horários, contatos e imagens revisadas."
      eyebrow="Catálogo da cidade"
      citySlug={resolvedCitySlug}
      activeSection="places"
      breadcrumbs={[{ label: 'Cidades', href: '/cidades' }, { label: cityName }]}
    >
      <CatalogSearchForm
        path={pagePath}
        query={result.query}
        total={result.meta.total}
        perPage={result.meta.perPage}
        sponsoredCount={result.sponsored.length}
        categories={categories}
      />

      {result.sponsored.length > 0 ? (
        <section
          aria-labelledby="sponsored-results"
          aria-describedby="sponsored-results-description"
          className="mt-8"
        >
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Patrocinado
            </p>
            <h2 id="sponsored-results" className="mt-1 text-xl font-semibold">
              Anúncios nesta cidade
            </h2>
            <p id="sponsored-results-description" className="mt-1 text-sm text-muted-foreground">
              Estes estabelecimentos pagaram por esta posição. Isso não representa uma avaliação de
              qualidade.
            </p>
          </div>
          <EstablishmentGrid entries={result.sponsored} citySlug={resolvedCitySlug} sponsored />
        </section>
      ) : null}

      <section aria-labelledby="organic-results" className="mt-8">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Catálogo publicado
          </p>
          <h2 id="organic-results" className="mt-1 text-xl font-semibold">
            {result.query.q ? `Resultados para “${result.query.q}”` : 'Todos os lugares'}
          </h2>
        </div>
        <EstablishmentGrid
          entries={result.organic}
          citySlug={resolvedCitySlug}
          emptyTitle={
            hasSponsoredResults
              ? result.query.q
                ? 'Nenhum outro resultado para esta busca'
                : 'Nenhum outro lugar encontrado'
              : result.query.q
                ? 'Nenhum resultado para esta busca'
                : 'Nenhum lugar publicado ainda'
          }
          emptyMessage={
            hasSponsoredResults
              ? 'Os anúncios patrocinados acima são exibidos separadamente e não entram na paginação do catálogo.'
              : result.query.q
                ? 'Tente remover filtros, buscar por outro termo ou navegar pelas categorias da cidade.'
                : 'Assim que novos estabelecimentos forem publicados, eles aparecerão aqui.'
          }
        />
      </section>

      <CatalogPagination path={pagePath} query={result.query} meta={result.meta} />
    </CatalogShell>
  )
}
