import { Link } from '@inertiajs/react'
import { ArrowRight, Grid2X2Plus } from 'lucide-react'

import { CatalogSectionHeader } from '~/components/catalog/catalog_section_header'
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
      description="Navegue pelas categorias com lugares publicados e encontre informações de endereço, horários e contato."
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
        <div className="rounded-card border border-dashed bg-card">
          <EmptyState
            icon={Grid2X2Plus}
            headingLevel={2}
            title="Nenhuma categoria publicada"
            description="Esta cidade ainda não tem categorias com lugares publicados no catálogo."
          />
        </div>
      ) : (
        <section aria-labelledby="available-categories-title">
          <CatalogSectionHeader
            id="available-categories-title"
            title="Categorias disponíveis"
            description="Escolha uma categoria para ver os lugares publicados."
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listing.categories.map((category) =>
              resolvedCitySlug ? (
                <Link
                  key={category.slug}
                  href={`/cidades/${encodeURIComponent(resolvedCitySlug)}/categorias/${encodeURIComponent(category.slug)}`}
                  aria-labelledby={`category-${category.slug}`}
                  className="group rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <article className="flex h-full min-w-0 flex-col rounded-card border border-border-subtle bg-card p-5 transition-colors group-hover:border-primary motion-reduce:transition-none sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span
                        aria-hidden="true"
                        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-lg font-extrabold leading-tight text-primary-accent"
                      >
                        {category.name.charAt(0).toLocaleUpperCase('pt-BR')}
                      </span>
                      <span className="inline-flex h-7 items-center rounded-full bg-background px-3 text-xs font-semibold text-muted-foreground">
                        {category.establishmentsCount}{' '}
                        {category.establishmentsCount === 1 ? 'opção' : 'opções'}
                      </span>
                    </div>
                    {category.familyName ? (
                      <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
                        {category.familyName}
                      </p>
                    ) : null}
                    <h3
                      id={`category-${category.slug}`}
                      className="mt-1.5 font-display text-xl font-extrabold leading-tight tracking-[-0.01em]"
                    >
                      {category.name}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {category.description ?? 'Explore os lugares publicados nesta categoria.'}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[0.9375rem] font-bold text-primary-accent group-hover:underline group-hover:underline-offset-4">
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
