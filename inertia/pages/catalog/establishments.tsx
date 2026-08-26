import { CatalogPagination } from '~/components/catalog/catalog_pagination'
import CatalogShell from '~/components/catalog/catalog_shell'
import { CatalogSearchForm } from '~/components/catalog/catalog_search_form'
import EstablishmentGrid from '~/components/catalog/establishment_grid'
import { useCatalogSearchAnalytics } from '~/components/catalog/use_catalog_analytics'
import { catalogSearch, slugLabel } from '~/lib/catalog'

interface CatalogEstablishmentsProps {
  catalog: unknown
  city_slug: string | null
}

export default function CatalogEstablishments({
  catalog,
  city_slug: citySlug,
}: CatalogEstablishmentsProps) {
  const result = catalogSearch(catalog)
  const firstItem = result.sponsored[0] ?? result.organic[0]
  const resolvedCitySlug = citySlug ?? firstItem?.citySlug ?? ''
  const cityName = firstItem?.cityName || slugLabel(resolvedCitySlug)
  const pagePath = `/cidades/${encodeURIComponent(resolvedCitySlug)}`

  useCatalogSearchAnalytics(resolvedCitySlug, result)

  return (
    <CatalogShell
      title={`O que conhecer em ${cityName || 'sua cidade'}`}
      description="Busque lugares e serviços locais publicados, com categorias, endereço, horários, contatos e imagens revisadas."
      eyebrow="Catálogo da cidade"
      citySlug={resolvedCitySlug}
      breadcrumbs={[{ label: 'Cidades', href: '/cidades' }, { label: cityName || 'Cidade' }]}
    >
      <CatalogSearchForm
        path={pagePath}
        query={result.query}
        total={result.meta.total}
        clearHref={pagePath}
      />

      {result.sponsored.length > 0 ? (
        <section aria-labelledby="sponsored-results" className="mt-10">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Destaques
            </p>
            <h2 id="sponsored-results" className="mt-1 text-xl font-semibold">
              Lugares em evidência
            </h2>
          </div>
          <EstablishmentGrid entries={result.sponsored} citySlug={resolvedCitySlug} sponsored />
        </section>
      ) : null}

      <section aria-labelledby="organic-results" className="mt-10">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
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
            result.query.q ? 'Nenhum resultado para esta busca' : 'Nenhum lugar publicado ainda'
          }
          emptyMessage={
            result.query.q
              ? 'Tente remover filtros, buscar por outro termo ou navegar pelas categorias da cidade.'
              : 'Assim que novos estabelecimentos forem publicados, eles aparecerão aqui.'
          }
        />
      </section>

      <CatalogPagination path={pagePath} query={result.query} meta={result.meta} />
    </CatalogShell>
  )
}
