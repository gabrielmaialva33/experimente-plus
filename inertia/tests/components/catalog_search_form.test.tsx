import { screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CatalogSearchForm } from '~/components/catalog/catalog_search_form'
import type { CatalogCategory, CatalogSearchQuery } from '~/lib/catalog'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const categories: CatalogCategory[] = [
  {
    slug: 'cafes',
    name: 'Cafés',
    description: 'Cafeterias e cafés especiais',
    icon: null,
    parentSlug: null,
    familyName: 'Gastronomia',
    establishmentsCount: 8,
    isPrimary: false,
  },
  {
    slug: 'restaurantes',
    name: 'Restaurantes',
    description: null,
    icon: null,
    parentSlug: null,
    familyName: 'Gastronomia',
    establishmentsCount: 12,
    isPrimary: false,
  },
]

const query: CatalogSearchQuery = {
  q: 'café',
  category: 'cafes',
  openNow: true,
  sort: 'name',
}

describe('CatalogSearchForm', () => {
  it('renders server-backed category filters and preserves the page size', () => {
    const { container } = render(
      <CatalogSearchForm
        path="/cidades/londrina"
        query={query}
        total={8}
        perPage={24}
        categories={categories}
      />
    )

    expect(screen.getByRole('searchbox', { name: 'O que você procura?' })).toHaveValue('café')
    expect(screen.getByRole('combobox', { name: 'Filtrar por categoria' })).toHaveValue('cafes')
    expect(screen.getByRole('option', { name: 'Cafés (8)' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Ordenar resultados' })).toHaveValue('name')
    expect(screen.getByRole('checkbox', { name: 'Aberto agora' })).toBeChecked()
    expect(container.querySelector('input[name="per_page"]')).toHaveValue('24')

    expect(screen.getByText('Categoria: Cafés')).toBeInTheDocument()
    expect(screen.getByText('Busca: “café”')).toBeInTheDocument()
    expect(screen.getByText('Ordenação: alfabética')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Limpar filtros' })).toHaveAttribute(
      'href',
      '/cidades/londrina'
    )
  })

  it('keeps a category page fixed while allowing its transient filters to be cleared', () => {
    render(
      <CatalogSearchForm
        path="/cidades/londrina/categorias/cafes"
        query={{ q: 'brunch', category: 'cafes', openNow: false, sort: 'relevance' }}
        total={3}
        perPage={20}
        categoryLabel="Cafés"
        includeCategoryParam={false}
      />
    )

    expect(
      screen.queryByRole('combobox', { name: 'Filtrar por categoria' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Categoria: Cafés')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Limpar filtros' })).toHaveAttribute(
      'href',
      '/cidades/londrina/categorias/cafes'
    )
  })
})
