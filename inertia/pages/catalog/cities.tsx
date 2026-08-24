import { Link } from '@inertiajs/react'

import CatalogShell from '../../components/catalog/catalog_shell'
import { collection, numberValue, stringValue } from '../../lib/catalog'

interface CatalogCitiesProps {
  catalog: unknown
}

export default function CatalogCities({ catalog }: CatalogCitiesProps) {
  const cities = collection(catalog)

  return (
    <CatalogShell
      title="Explore cidades do Norte do Paraná"
      description="Encontre restaurantes, cafés, bares, cultura, lazer e serviços locais a partir de informações publicadas e moderadas."
    >
      {cities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <h2 className="text-lg font-semibold">O catálogo está sendo preparado</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            As primeiras cidades aparecerão aqui assim que houver estabelecimentos publicados.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((city, index) => {
            const slug = stringValue(city, 'slug', 'city_slug') ?? `cidade-${index}`
            const name = stringValue(city, 'name', 'city_name') ?? 'Cidade'
            const state = stringValue(city, 'state_code', 'state', 'uf')
            const count = numberValue(
              city,
              'establishment_count',
              'establishments_count',
              'published_establishments_count'
            )

            return (
              <article
                key={`${slug}-${index}`}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <p className="text-sm font-medium text-primary">{state ?? 'Paraná'}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{name}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {count === null
                    ? 'Descubra lugares e serviços publicados nesta cidade.'
                    : `${count} ${count === 1 ? 'estabelecimento publicado' : 'estabelecimentos publicados'}.`}
                </p>
                <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
                  <Link
                    href={`/cidades/${encodeURIComponent(slug)}`}
                    className="text-primary transition hover:opacity-80"
                  >
                    Explorar cidade →
                  </Link>
                  <Link
                    href={`/cidades/${encodeURIComponent(slug)}/categorias`}
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    Ver categorias
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </CatalogShell>
  )
}
