import { Link } from '@inertiajs/react'
import { screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CatalogCategories from '~/pages/catalog/categories'
import CatalogCities from '~/pages/catalog/cities'
import { render } from '~/tests/test_utils'

vi.mock('~/components/catalog/catalog_shell', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

describe('catalog destination cards', () => {
  beforeEach(() => {
    vi.mocked(Link).mockClear()
  })

  it('gives each city card one destination', () => {
    render(
      <CatalogCities
        catalog={{
          cities: [
            {
              slug: 'cornelio-procopio',
              name: 'Cornélio Procópio',
              state_code: 'PR',
              region_name: 'Norte Pioneiro',
              establishments_count: 12,
            },
          ],
        }}
      />
    )

    expect(screen.getByRole('heading', { level: 3, name: 'Cornélio Procópio' })).toBeInTheDocument()
    expect(Link).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Link).mock.calls[0]?.[0]).toMatchObject({
      'href': '/cidades/cornelio-procopio',
      'aria-labelledby': 'city-cornelio-procopio',
    })
  })

  it('gives each category card one destination', () => {
    render(
      <CatalogCategories
        city_slug="cornelio-procopio"
        catalog={{
          city: {
            slug: 'cornelio-procopio',
            name: 'Cornélio Procópio',
            state_code: 'PR',
            timezone: 'America/Sao_Paulo',
          },
          categories: [
            {
              slug: 'cafes',
              name: 'Cafés',
              description: 'Cafés e boas pausas.',
              family_name: 'Gastronomia',
              establishments_count: 4,
            },
          ],
        }}
      />
    )

    expect(screen.getByRole('heading', { level: 3, name: 'Cafés' })).toBeInTheDocument()
    expect(Link).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Link).mock.calls[0]?.[0]).toMatchObject({
      'href': '/cidades/cornelio-procopio/categorias/cafes',
      'aria-labelledby': 'category-cafes',
    })
  })
})
