import { Link } from '@inertiajs/react'
import { ArrowRight, Grid2X2Plus } from 'lucide-react'

import { CatalogSectionHeader } from '~/components/catalog/catalog_section_header'
import CatalogShell from '~/components/catalog/catalog_shell'
import { EmptyState } from '~/components/empty_state'
import { catalogCategories, type CatalogCategory } from '~/lib/catalog'

interface CatalogCategoriesProps {
  catalog: unknown
  city_slug: string
}

interface CategoryGroup {
  name: string | null
  categories: CatalogCategory[]
}

/**
 * Categories under their family, in the order the server sent them.
 *
 * A city with the whole taxonomy lists a dozen and a half categories; as one flat
 * grid every card repeated its family as an overline and a phone scrolled through
 * 4,600px of them. A family heading says it once. Without families (an older
 * payload), the list stays flat.
 */
function groupByFamily(categories: CatalogCategory[]): CategoryGroup[] {
  const groups: CategoryGroup[] = []
  for (const category of categories) {
    const group = groups.find((entry) => entry.name === category.familyName)
    if (group) group.categories.push(category)
    else groups.push({ name: category.familyName, categories: [category] })
  }
  return groups
}

function CategoryCard({
  category,
  citySlug,
  headingLevel,
}: {
  category: CatalogCategory
  citySlug: string
  headingLevel: 'h3' | 'h4'
}) {
  const Heading = headingLevel
  const count = `${category.establishmentsCount} ${category.establishmentsCount === 1 ? 'lugar' : 'lugares'}`

  return (
    <Link
      href={`/cidades/${encodeURIComponent(citySlug)}/categorias/${encodeURIComponent(category.slug)}`}
      aria-labelledby={`category-${category.slug}`}
      className="group rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {/* A row on a phone (the whole card is the link), a card from 640px. */}
      <article className="flex h-full min-w-0 items-center gap-4 rounded-card border border-border-subtle bg-card p-4 transition-colors group-hover:border-primary motion-reduce:transition-none sm:flex-col sm:items-stretch sm:gap-0 sm:p-6">
        <div className="flex shrink-0 items-start justify-between gap-4">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-lg font-extrabold leading-tight text-primary-accent"
          >
            {category.name.charAt(0).toLocaleUpperCase('pt-BR')}
          </span>
          <span className="hidden h-7 items-center rounded-full bg-background px-3 text-xs font-semibold text-muted-foreground sm:inline-flex">
            {count}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col sm:mt-5">
          <Heading
            id={`category-${category.slug}`}
            className="font-display text-lg font-extrabold leading-tight tracking-[-0.01em] sm:text-xl"
          >
            {category.name}
          </Heading>
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground sm:hidden">{count}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground sm:mt-2 sm:line-clamp-3">
            {category.description ?? 'Explore os lugares publicados nesta categoria.'}
          </p>
          <span className="mt-auto hidden items-center gap-2 pt-5 text-[0.9375rem] font-bold text-primary-accent group-hover:underline group-hover:underline-offset-4 sm:inline-flex">
            Explorar categoria <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </div>
        <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-primary-accent sm:hidden" />
      </article>
    </Link>
  )
}

export default function CatalogCategories({ catalog }: CatalogCategoriesProps) {
  const listing = catalogCategories(catalog)
  const resolvedCitySlug = listing.city.slug
  const cityName = listing.city.name
  const groups = groupByFamily(listing.categories)
  const grouped = groups.some((group) => group.name !== null)
  const gridClassName = 'grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3'

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

          {resolvedCitySlug ? (
            grouped ? (
              <div className="space-y-8">
                {groups.map((group, index) => {
                  const headingId = `category-family-${index}`
                  return (
                    <section key={group.name ?? 'other'} aria-labelledby={headingId}>
                      <h3
                        id={headingId}
                        className="mb-3 flex items-baseline gap-2 text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent"
                      >
                        {group.name ?? 'Outras categorias'}
                        <span className="font-semibold normal-case tracking-normal text-muted-foreground">
                          {group.categories.length}{' '}
                          {group.categories.length === 1 ? 'categoria' : 'categorias'}
                        </span>
                      </h3>
                      <div className={gridClassName}>
                        {group.categories.map((category) => (
                          <CategoryCard
                            key={category.slug}
                            category={category}
                            citySlug={resolvedCitySlug}
                            headingLevel="h4"
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className={gridClassName}>
                {listing.categories.map((category) => (
                  <CategoryCard
                    key={category.slug}
                    category={category}
                    citySlug={resolvedCitySlug}
                    headingLevel="h3"
                  />
                ))}
              </div>
            )
          ) : null}
        </section>
      )}
    </CatalogShell>
  )
}
