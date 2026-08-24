import { Link } from '@inertiajs/react'

import CatalogShell from '../../components/catalog/catalog_shell'
import { collection, numberValue, slugLabel, stringValue } from '../../lib/catalog'

interface CatalogCategoriesProps {
  catalog: unknown
  city_slug: string | null
}

export default function CatalogCategories({
  catalog,
  city_slug: citySlug,
}: CatalogCategoriesProps) {
  const categories = collection(catalog)
  const cityName =
    categories.length > 0
      ? (stringValue(categories[0], 'city_name') ?? slugLabel(citySlug))
      : slugLabel(citySlug)
  const resolvedCitySlug = citySlug ?? stringValue(categories[0] ?? null, 'city_slug') ?? ''

  return (
    <CatalogShell
      title={`Categorias em ${cityName || 'sua cidade'}`}
      description="Navegue por categorias locais e encontre opções publicadas com endereço, horários, contato e mídia moderada."
      eyebrow="Categorias locais"
    >
      <div className="mb-8 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/cidades" className="text-muted-foreground transition hover:text-foreground">
          ← Todas as cidades
        </Link>
        {resolvedCitySlug ? (
          <Link
            href={`/cidades/${encodeURIComponent(resolvedCitySlug)}`}
            className="text-primary transition hover:opacity-80"
          >
            Ver todos os estabelecimentos
          </Link>
        ) : null}
      </div>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <h2 className="text-lg font-semibold">Nenhuma categoria publicada</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta cidade ainda não possui categorias com estabelecimentos disponíveis no catálogo.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => {
            const slug = stringValue(category, 'slug', 'category_slug') ?? `categoria-${index}`
            const name = stringValue(category, 'name', 'category_name') ?? slugLabel(slug)
            const description = stringValue(category, 'description')
            const count = numberValue(
              category,
              'establishment_count',
              'establishments_count',
              'published_establishments_count'
            )

            return (
              <article
                key={`${slug}-${index}`}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {description ??
                    (count === null
                      ? 'Explore estabelecimentos publicados nesta categoria.'
                      : `${count} ${count === 1 ? 'opção publicada' : 'opções publicadas'}.`)}
                </p>
                {resolvedCitySlug ? (
                  <Link
                    href={`/cidades/${encodeURIComponent(resolvedCitySlug)}/categorias/${encodeURIComponent(slug)}`}
                    className="mt-5 inline-flex text-sm font-semibold text-primary transition hover:opacity-80"
                  >
                    Explorar categoria →
                  </Link>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </CatalogShell>
  )
}
