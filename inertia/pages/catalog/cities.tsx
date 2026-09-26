import { Link } from '@inertiajs/react'
import { ArrowRight, Building2, MapPinned } from 'lucide-react'

import { CatalogSectionHeader } from '~/components/catalog/catalog_section_header'
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
      description="Veja os lugares publicados em cada cidade e encontre opções por categoria, nome ou disponibilidade."
      breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cidades' }]}
    >
      {cities.length === 0 ? (
        <div className="rounded-card border border-dashed bg-card">
          <EmptyState
            icon={MapPinned}
            headingLevel={2}
            title="O catálogo está sendo preparado"
            description="As primeiras cidades aparecerão aqui assim que houver lugares publicados."
          />
        </div>
      ) : (
        <section aria-labelledby="available-cities-title">
          <CatalogSectionHeader
            id="available-cities-title"
            title="Cidades disponíveis"
            description="Selecione uma cidade para começar a explorar."
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <Link
                key={city.slug}
                href={`/cidades/${encodeURIComponent(city.slug)}`}
                aria-labelledby={`city-${city.slug}`}
                className="group rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <article className="flex h-full flex-col rounded-card border border-border-subtle bg-card p-5 transition-colors group-hover:border-primary motion-reduce:transition-none sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
                      <MapPinned aria-hidden="true" className="size-5" />
                    </span>
                    <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                      {city.stateCode ?? 'Cidade disponível'}
                    </span>
                  </div>
                  <h3
                    id={`city-${city.slug}`}
                    className="mt-5 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em]"
                  >
                    {city.name}
                  </h3>
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 aria-hidden="true" className="size-4" />
                    {city.establishmentsCount}{' '}
                    {city.establishmentsCount === 1 ? 'lugar publicado' : 'lugares publicados'}
                  </p>
                  {city.regionName ? (
                    <p className="mt-2 text-sm text-muted-foreground">{city.regionName}</p>
                  ) : null}

                  <span className="mt-auto inline-flex items-center gap-2 pt-6 text-[0.9375rem] font-bold text-primary-accent group-hover:underline group-hover:underline-offset-4">
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
