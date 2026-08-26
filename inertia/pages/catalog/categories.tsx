import { Link } from '@inertiajs/react'
import { ArrowUpRight, Grid2X2Plus } from 'lucide-react'

import CatalogShell from '~/components/catalog/catalog_shell'
import { Button } from '~/components/ui/button'
import { catalogCategories, slugLabel } from '~/lib/catalog'

interface CatalogCategoriesProps {
  catalog: unknown
  city_slug: string | null
}

export default function CatalogCategories({
  catalog,
  city_slug: citySlug,
}: CatalogCategoriesProps) {
  const listing = catalogCategories(catalog)
  const resolvedCitySlug = listing.city?.slug ?? citySlug ?? ''
  const cityName = listing.city?.name ?? slugLabel(resolvedCitySlug)

  return (
    <CatalogShell
      title={`Categorias em ${cityName || 'sua cidade'}`}
      description="Navegue pelas categorias com oferta publicada e encontre opções com endereço, horários, contatos e mídia moderada."
      eyebrow="Categorias locais"
      citySlug={resolvedCitySlug}
      breadcrumbs={[
        { label: 'Cidades', href: '/cidades' },
        {
          label: cityName || 'Cidade',
          href: resolvedCitySlug ? `/cidades/${resolvedCitySlug}` : undefined,
        },
        { label: 'Categorias' },
      ]}
      actions={
        resolvedCitySlug ? (
          <Button variant="outline" asChild>
            <Link href={`/cidades/${encodeURIComponent(resolvedCitySlug)}`}>
              Ver todos os lugares
            </Link>
          </Button>
        ) : null
      }
    >
      {listing.categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Grid2X2Plus className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Nenhuma categoria publicada</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Esta cidade ainda não possui categorias com estabelecimentos disponíveis no catálogo.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listing.categories.map((category) => (
            <article
              key={category.slug}
              className="group flex min-w-0 flex-col rounded-2xl border bg-card p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-foreground">
                  {category.name.charAt(0).toLocaleUpperCase('pt-BR')}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {category.establishmentsCount}{' '}
                  {category.establishmentsCount === 1 ? 'opção' : 'opções'}
                </span>
              </div>
              {category.familyName ? (
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                  {category.familyName}
                </p>
              ) : null}
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">{category.name}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {category.description ?? 'Explore estabelecimentos publicados nesta categoria.'}
              </p>
              {resolvedCitySlug ? (
                <Link
                  href={`/cidades/${encodeURIComponent(resolvedCitySlug)}/categorias/${encodeURIComponent(category.slug)}`}
                  className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-primary transition hover:gap-2.5"
                >
                  Explorar categoria <ArrowUpRight className="size-4" />
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </CatalogShell>
  )
}
