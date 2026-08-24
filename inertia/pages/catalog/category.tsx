import { Link } from '@inertiajs/react'

import CatalogShell from '../../components/catalog/catalog_shell'
import EstablishmentGrid from '../../components/catalog/establishment_grid'
import { collection, slugLabel, stringValue } from '../../lib/catalog'

interface CatalogCategoryProps {
  catalog: unknown
  city_slug: string | null
  category_slug: string | null
}

export default function CatalogCategory({
  catalog,
  city_slug: citySlug,
  category_slug: categorySlug,
}: CatalogCategoryProps) {
  const establishments = collection(catalog)
  const resolvedCitySlug = citySlug ?? stringValue(establishments[0] ?? null, 'city_slug') ?? ''
  const resolvedCategorySlug =
    categorySlug ?? stringValue(establishments[0] ?? null, 'category_slug') ?? ''
  const cityName =
    stringValue(establishments[0] ?? null, 'city_name') ?? slugLabel(resolvedCitySlug)
  const categoryName =
    stringValue(establishments[0] ?? null, 'primary_category_name', 'category_name') ??
    slugLabel(resolvedCategorySlug)

  return (
    <CatalogShell
      title={`${categoryName || 'Categoria'} em ${cityName || 'sua cidade'}`}
      description="Veja opções locais publicadas nesta categoria, com dados revisados para facilitar sua decisão."
      eyebrow="Descoberta por categoria"
    >
      <div className="mb-8 flex flex-wrap gap-4 text-sm font-semibold">
        {resolvedCitySlug ? (
          <Link
            href={`/cidades/${encodeURIComponent(resolvedCitySlug)}/categorias`}
            className="text-muted-foreground transition hover:text-foreground"
          >
            ← Todas as categorias
          </Link>
        ) : (
          <Link href="/cidades" className="text-muted-foreground transition hover:text-foreground">
            ← Todas as cidades
          </Link>
        )}
        {resolvedCitySlug ? (
          <Link
            href={`/cidades/${encodeURIComponent(resolvedCitySlug)}`}
            className="text-primary transition hover:opacity-80"
          >
            Ver catálogo completo
          </Link>
        ) : null}
      </div>

      <EstablishmentGrid
        entries={establishments}
        citySlug={resolvedCitySlug}
        emptyMessage="Ainda não há estabelecimentos publicados nesta categoria."
      />
    </CatalogShell>
  )
}
