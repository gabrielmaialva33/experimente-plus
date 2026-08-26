import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CatalogSearchForm } from '~/components/catalog/catalog_search_form'
import type { CatalogCategory, CatalogSearchQuery } from '~/lib/catalog'
import { render } from '~/tests/test_utils'

const categories: CatalogCategory[] = [
  {
    slug: 'cafes',
    name: 'Cafés',
    description: 'Cafés e boas pausas.',
    icon: null,
    parentSlug: null,
    familyName: 'Gastronomia',
    establishmentsCount: 4,
    isPrimary: false,
  },
  {
    slug: 'restaurantes',
    name: 'Restaurantes',
    description: null,
    icon: null,
    parentSlug: null,
    familyName: 'Gastronomia',
    establishmentsCount: 7,
    isPrimary: false,
  },
]

const defaultQuery: CatalogSearchQuery = {
  q: '',
  category: null,
  openNow: false,
  sort: 'relevance',
}

describe('CatalogSearchForm', () => {
  it('renders the published category filter with counts', () => {
    render(
      <CatalogSearchForm
        path="/cidades/cornelio-procopio"
        query={defaultQuery}
        total={11}
        perPage={20}
        categories={categories}
      />
    )

    const select = screen.getByLabelText('Filtrar por categoria')
    expect(select).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Todas as categorias' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cafés (4)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Restaurantes (7)' })).toBeInTheDocument()
    expect(screen.getByText('11 resultados publicados')).toBeInTheDocument()
  })

  it('preserves the current search, category, sorting and open-now filters', () => {
    render(
      <CatalogSearchForm
        path="/cidades/cornelio-procopio"
        query={{ q: 'brunch', category: 'cafes', openNow: true, sort: 'recent' }}
        total={2}
        perPage={20}
        categories={categories}
      />
    )

    expect(screen.getByRole('searchbox', { name: 'O que você procura?' })).toHaveValue('brunch')
    expect(screen.getByLabelText('Filtrar por categoria')).toHaveValue('cafes')
    expect(screen.getByLabelText('Ordenar resultados')).toHaveValue('recent')
    expect(screen.getByRole('checkbox', { name: 'Aberto agora' })).toBeChecked()
    expect(screen.getByText('Busca: “brunch”')).toBeInTheDocument()
    expect(screen.getByText('Limpar filtros')).toBeInTheDocument()
  })

  it('keeps the route category fixed on category pages', () => {
    render(
      <CatalogSearchForm
        path="/cidades/cornelio-procopio/categorias/cafes"
        query={{ ...defaultQuery, category: 'cafes' }}
        total={4}
        perPage={20}
        categoryLabel="Cafés"
        categories={categories}
        includeCategoryParam={false}
      />
    )

    expect(screen.queryByLabelText('Filtrar por categoria')).not.toBeInTheDocument()
    expect(screen.getByText('Categoria: Cafés')).toBeInTheDocument()
  })
})
