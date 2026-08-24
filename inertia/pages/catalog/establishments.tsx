import { Link } from '@inertiajs/react'

import CatalogShell from '../../components/catalog/catalog_shell'
import EstablishmentGrid from '../../components/catalog/establishment_grid'
import { collection, metadata, numberValue, slugLabel, stringValue } from '../../lib/catalog'

interface CatalogEstablishmentsProps {
  catalog: unknown
  city_slug: string | null
}

export default function CatalogEstablishments({
  catalog,
  city_slug: citySlug,
}: CatalogEstablishmentsProps) {
  const establishments = collection(catalog)
  const meta = metadata(catalog)
  const resolvedCitySlug = citySlug ?? stringValue(establishments[0] ?? null, 'city_slug') ?? ''
  const cityName =
    stringValue(establishments[0] ?? null, 'city_name') ?? slugLabel(resolvedCitySlug)
  const total = numberValue(meta, 'total', 'total_items')

  return (
    <CatalogShell
      title={`O que conhecer em ${cityName || 'sua cidade'}`}
      description="Explore estabelecimentos locais publicados, com categorias, contatos, horários e imagens moderadas pela plataforma."
      eyebrow="Catálogo da cidade"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/cidades" className="text-muted-foreground transition hover:text-foreground">
            ← Todas as cidades
          </Link>
          {resolvedCitySlug ? (
            <Link
              href={`/cidades/${encodeURIComponent(resolvedCitySlug)}/categorias`}
              className="text-primary transition hover:opacity-80"
            >
              Navegar por categorias
            </Link>
          ) : null}
        </div>
        {total !== null ? (
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'resultado' : 'resultados'}
          </p>
        ) : null}
      </div>

      <EstablishmentGrid entries={establishments} citySlug={resolvedCitySlug} />
    </CatalogShell>
  )
}
