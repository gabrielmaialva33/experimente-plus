import { router } from '@inertiajs/react'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  beforeEach(() => {
    vi.mocked(router.get).mockClear()
  })

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

    const select = screen.getByRole('combobox', { name: 'Categoria' })
    expect(select).toHaveValue('')
    expect(select).not.toHaveAttribute('aria-label')
    expect(screen.getByRole('option', { name: 'Todas as categorias' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cafés (4)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Restaurantes (7)' })).toBeInTheDocument()
    expect(screen.getByText('11 resultados no catálogo')).toBeInTheDocument()
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
    expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveValue('cafes')
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('recent')
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

    expect(screen.queryByRole('combobox', { name: 'Categoria' })).not.toBeInTheDocument()
    expect(screen.getByText('Categoria: Cafés')).toBeInTheDocument()
  })

  it('submits normalized filters through Inertia and announces the loading state', async () => {
    const { user } = render(
      <CatalogSearchForm
        path="/cidades/cornelio-procopio"
        query={defaultQuery}
        total={11}
        perPage={20}
        categories={categories}
      />
    )

    await user.type(screen.getByRole('searchbox', { name: 'O que você procura?' }), '  brunch  ')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), 'cafes')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), 'recent')
    await user.click(screen.getByRole('checkbox', { name: 'Aberto agora' }))
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(router.get).toHaveBeenCalledWith(
      '/cidades/cornelio-procopio',
      {
        per_page: '20',
        q: 'brunch',
        category: 'cafes',
        sort: 'recent',
        open_now: 'true',
      },
      expect.objectContaining({ preserveState: true, replace: true })
    )
    expect(screen.getByRole('search')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled()
  })
})
