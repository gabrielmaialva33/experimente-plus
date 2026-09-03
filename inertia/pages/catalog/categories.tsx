import { Link } from '@inertiajs/react'
import { ArrowRight, Grid2X2Plus } from 'lucide-react'

import CatalogShell from '~/components/catalog/catalog_shell'
import { EmptyState } from '~/components/empty_state'
import { catalogCategories } from '~/lib/catalog'

interface CatalogCategoriesProps {
  catalog: unknown
  city_slug: string
}

export default function CatalogCategories({ catalog }: CatalogCategoriesProps) {
  const listing = catalogCategories(catalog)
  const resolvedCitySlug = listing.city.slug
  const cityName = listing.city.name

  return (
    <CatalogShell
      title={`Categorias em ${cityName}`}
      description="Navegue pelas categorias com estabelecimentos publicados e encontre informações de endereço, horários e contato."
      eyebrow="Categorias locais"
      citySlug={resolvedCitySlug}
      activeSection="categories"
      breadcrumbs={[
        { label: 'Cidades', href: '/cidades' },
        {
          label: cityName,
          href: `/cidades/${encodeURIComponent(resolvedCitySlug)}`,
        },
        { label: 'Categorias' },
      ]}
    >
      {listing.categories.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card">
          <EmptyState
            icon={Grid2X2Plus}
            headingLevel={2}
            title="Nenhuma categoria publicada"
            description="Esta cidade ainda não possui categorias com estabelecimentos disponíveis no catálogo."
          />
        </div>
      ) : (
        <section aria-labelledby="available-categories-title">
          <div className="mb-4">
            <h2 id="available-categories-title" className="text-xl font-semibold">
              Categorias disponíveis
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha uma categoria para ver os estabelecimentos publicados.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listing.categories.map((category) =>
              resolvedCitySlug ? (
                <Link
                  key={category.slug}
                  href={`/cidades/${encodeURIComponent(resolvedCitySlug)}/categorias/${encodeURIComponent(category.slug)}`}
                  aria-labelledby={`category-${category.slug}`}
                  className="group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <article className="flex h-full min-w-0 flex-col rounded-lg border bg-card p-5 transition-colors group-hover:border-primary/45 motion-reduce:transition-none sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary-soft text-base font-semibold text-primary-accent">
                        {category.name.charAt(0).toLocaleUpperCase('pt-BR')}
                      </span>
                      <span className="rounded-md border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {category.establishmentsCount}{' '}
                        {category.establishmentsCount === 1 ? 'opção' : 'opções'}
                      </span>
                    </div>
                    {category.familyName ? (
                      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                        {category.familyName}
                      </p>
                    ) : null}
                    <h3
                      id={`category-${category.slug}`}
                      className="mt-2 text-xl font-semibold tracking-tight"
                    >
                      {category.name}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {category.description ??
                        'Explore estabelecimentos publicados nesta categoria.'}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-primary group-hover:underline group-hover:underline-offset-4">
                      Explorar categoria <ArrowRight aria-hidden="true" className="size-4" />
                    </span>
                  </article>
                </Link>
              ) : null
            )}
          </div>
        </section>
      )}
    </CatalogShell>
  )
}
