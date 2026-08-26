import { Link } from '@inertiajs/react'
import { ArrowUpRight, Building2, MapPinned } from 'lucide-react'

import CatalogShell from '~/components/catalog/catalog_shell'
import { Button } from '~/components/ui/button'
import { catalogCities } from '~/lib/catalog'

interface CatalogCitiesProps {
  catalog: unknown
}

export default function CatalogCities({ catalog }: CatalogCitiesProps) {
  const cities = catalogCities(catalog)

  return (
    <CatalogShell
      title="Explore cidades do Norte do Paraná"
      description="Escolha uma cidade e encontre restaurantes, cafés, cultura, lazer, bem-estar e serviços locais com informações publicadas e revisadas."
      breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Cidades' }]}
      actions={
        <Button variant="outline" asChild>
          <Link href="/register">Cadastrar meu negócio</Link>
        </Button>
      }
    >
      {cities.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MapPinned className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">O catálogo está sendo preparado</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            As primeiras cidades aparecerão aqui assim que houver estabelecimentos publicados.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((city) => (
            <article
              key={city.slug}
              className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="absolute end-0 top-0 size-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/10 blur-2xl" />
              <span className="relative flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <MapPinned className="size-5" />
              </span>
              <p className="relative mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                {city.stateCode ?? 'Paraná'}
              </p>
              <h2 className="relative mt-2 text-2xl font-semibold tracking-[-0.03em]">
                {city.name}
              </h2>
              <p className="relative mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="size-4" />
                {city.establishmentsCount}{' '}
                {city.establishmentsCount === 1
                  ? 'estabelecimento publicado'
                  : 'estabelecimentos publicados'}
              </p>
              {city.regionName ? (
                <p className="relative mt-2 text-xs text-muted-foreground">
                  Região: {city.regionName}
                </p>
              ) : null}

              <div className="relative mt-6 flex flex-wrap items-center gap-3">
                <Button asChild>
                  <Link href={`/cidades/${encodeURIComponent(city.slug)}`}>
                    Explorar <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
                <Link
                  href={`/cidades/${encodeURIComponent(city.slug)}/categorias`}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  Categorias
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </CatalogShell>
  )
}
