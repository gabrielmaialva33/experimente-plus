import { screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import CatalogCategories from '~/pages/catalog/categories'
import CatalogCategory from '~/pages/catalog/category'
import CatalogCities from '~/pages/catalog/cities'
import CatalogEstablishments from '~/pages/catalog/establishments'
import { render } from '~/tests/test_utils'

vi.mock('~/components/catalog/catalog_shell', () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

vi.mock('~/components/catalog/use_catalog_analytics', () => ({
  useCatalogSearchAnalytics: vi.fn(),
}))

const emptySearch = {
  context: {
    city: {
      slug: 'cornelio-procopio',
      name: 'Cornélio Procópio',
      state_code: 'PR',
      timezone: 'America/Sao_Paulo',
    },
    category: null,
  },
  sponsored_results: [],
  organic_results: [],
  meta: { total: 0, page: 1, per_page: 20, last_page: 1 },
  query: { q: null, category: null, open_now: false, sort: 'relevance' },
}

describe('catalog page canonical context', () => {
  it('uses the requested parent category and canonical city instead of a child result', () => {
    render(
      <CatalogCategory
        city_slug="cidade-da-url"
        category_slug="categoria-da-url"
        catalog={{
          ...emptySearch,
          context: {
            city: {
              slug: 'londrina',
              name: 'Londrina',
              state_code: 'PR',
              timezone: 'America/Sao_Paulo',
            },
            category: {
              slug: 'gastronomia',
              name: 'Gastronomia',
              description: null,
              icon: null,
              parent_slug: null,
              family: { slug: 'comer-e-beber', name: 'Comer e beber', icon: null },
            },
          },
          organic_results: [
            {
              slug: 'cafe-filho',
              name: 'Café Filho',
              city: { slug: 'outra-cidade', name: 'Outra Cidade', state_code: 'PR' },
              business_status: 'open',
              is_open_now: true,
              primary_category: {
                slug: 'cafeterias',
                name: 'Cafeterias',
                parent_slug: 'gastronomia',
                is_primary: true,
              },
              categories: [
                {
                  slug: 'cafeterias',
                  name: 'Cafeterias',
                  parent_slug: 'gastronomia',
                  is_primary: true,
                },
              ],
            },
          ],
          meta: { total: 1, page: 1, per_page: 20, last_page: 1 },
          query: { q: null, category: 'gastronomia', open_now: false, sort: 'relevance' },
        }}
      />
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Gastronomia em Londrina' })).toBeVisible()
    expect(screen.getByText('Categoria: Gastronomia')).toBeVisible()
    expect(screen.queryByRole('heading', { name: /Cafeterias em Outra Cidade/ })).toBeNull()
  })

  it('preserves the accented canonical city when the search has no cards', () => {
    render(
      <CatalogEstablishments
        catalog={emptySearch}
        city_slug="cornelio-procopio"
        filter_categories={{
          city: {
            slug: 'cornelio-procopio',
            name: 'Cornélio Procópio',
            state_code: 'PR',
            timezone: 'America/Sao_Paulo',
          },
          categories: [],
        }}
      />
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'O que conhecer em Cornélio Procópio' })
    ).toBeVisible()
  })

  it('separates sponsored cards from an empty paginated catalog', () => {
    render(
      <CatalogEstablishments
        city_slug="cornelio-procopio"
        filter_categories={{
          city: {
            slug: 'cornelio-procopio',
            name: 'Cornélio Procópio',
            state_code: 'PR',
            timezone: 'America/Sao_Paulo',
          },
          categories: [],
        }}
        catalog={{
          ...emptySearch,
          sponsored_results: [
            {
              slug: 'cafe-anunciante',
              name: 'Café Anunciante',
              city: {
                slug: 'cornelio-procopio',
                name: 'Cornélio Procópio',
                state_code: 'PR',
              },
              business_status: 'open',
              is_open_now: true,
              is_sponsored: true,
              categories: [],
            },
          ],
        }}
      />
    )

    expect(screen.getByText('0 resultados no catálogo · 1 anúncio patrocinado')).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Nenhum outro lugar encontrado' })
    ).toBeVisible()
    expect(screen.queryByText('Nenhum lugar publicado ainda')).toBeNull()
    expect(
      screen.getByText(
        'Os anúncios patrocinados acima são exibidos separadamente e não entram na paginação do catálogo.'
      )
    ).toBeVisible()
  })

  it('keeps direct public empty states immediately below the page heading', () => {
    const { rerender } = render(<CatalogCities catalog={[]} />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'O catálogo está sendo preparado' })
    ).toBeVisible()

    rerender(
      <CatalogCategories
        city_slug="cornelio-procopio"
        catalog={{
          city: {
            slug: 'cornelio-procopio',
            name: 'Cornélio Procópio',
            state_code: 'PR',
            timezone: 'America/Sao_Paulo',
          },
          categories: [],
        }}
      />
    )

    expect(
      screen.getByRole('heading', { level: 2, name: 'Nenhuma categoria publicada' })
    ).toBeVisible()
  })
})
