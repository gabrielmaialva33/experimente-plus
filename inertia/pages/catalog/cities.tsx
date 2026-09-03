import { Link } from '@inertiajs/react'
import { ArrowRight, Building2, MapPinned } from 'lucide-react'

import CatalogShell from '~/components/catalog/catalog_shell'
import { EmptyState } from '~/components/empty_state'
import { catalogCities } from '~/lib/catalog'

interface CatalogCitiesProps {
  catalog: unknown
}

export default function CatalogCities({ catalog }: CatalogCitiesProps) {
  const cities = catalogCities(catalog)

  return (
    <CatalogShell
      title="Escolha uma cidade"
      description="Veja os estabelecimentos publicados em cada cidade e encontre opções por categoria, nome ou disponibilidade."
      breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cidades' }]}
    >
      {cities.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card">
          <EmptyState
            icon={MapPinned}
            headingLevel={2}
            title="O catálogo está sendo preparado"
            description="As primeiras cidades aparecerão aqui assim que houver estabelecimentos publicados."
          />
        </div>
      ) : (
        <section aria-labelledby="available-cities-title">
          <div className="mb-4">
            <h2 id="available-cities-title" className="text-xl font-semibold">
              Cidades disponíveis
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione uma cidade para começar a explorar.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <Link
                key={city.slug}
                href={`/cidades/${encodeURIComponent(city.slug)}`}
                aria-labelledby={`city-${city.slug}`}
                className="group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <article className="flex h-full flex-col rounded-lg border bg-card p-5 transition-colors group-hover:border-primary/45 motion-reduce:transition-none sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-10 items-center justify-center rounded-md border border-primary/15 bg-primary-soft text-primary-accent">
                      <MapPinned aria-hidden="true" className="size-5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {city.stateCode ?? 'Cidade disponível'}
                    </span>
                  </div>
                  <h3
                    id={`city-${city.slug}`}
                    className="mt-5 text-2xl font-semibold tracking-tight"
                  >
                    {city.name}
                  </h3>
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 aria-hidden="true" className="size-4" />
                    {city.establishmentsCount}{' '}
                    {city.establishmentsCount === 1
                      ? 'estabelecimento publicado'
                      : 'estabelecimentos publicados'}
                  </p>
                  {city.regionName ? (
                    <p className="mt-2 text-sm text-muted-foreground">{city.regionName}</p>
                  ) : null}

                  <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-primary group-hover:underline group-hover:underline-offset-4">
                    Explorar cidade <ArrowRight aria-hidden="true" className="size-4" />
                  </span>
                </article>
              </Link>
            ))}
          </div>
        </section>
      )}
    </CatalogShell>
  )
}
