import { Link } from '@inertiajs/react'
import { screen, within } from '@testing-library/react'
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

    expect(screen.getByRole('heading', { level: 4, name: 'Cafés' })).toBeInTheDocument()
    expect(Link).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Link).mock.calls[0]?.[0]).toMatchObject({
      'href': '/cidades/cornelio-procopio/categorias/cafes',
      'aria-labelledby': 'category-cafes',
    })
  })

  it('lists categories under their family once, in the order the server sent', () => {
    render(
      <CatalogCategories
        city_slug="londrina"
        catalog={{
          city: {
            slug: 'londrina',
            name: 'Londrina',
            state_code: 'PR',
            timezone: 'America/Sao_Paulo',
          },
          categories: [
            { slug: 'bares', name: 'Bares', family_name: 'Comer & beber', establishments_count: 2 },
            {
              slug: 'cinema',
              name: 'Cinema',
              family_name: 'Cultura & lazer',
              establishments_count: 1,
            },
            { slug: 'cafes', name: 'Cafés', family_name: 'Comer & beber', establishments_count: 1 },
          ],
        }}
      />
    )

    const families = screen.getAllByRole('heading', { level: 3 })
    expect(families.map((heading) => heading.textContent)).toEqual([
      'Comer & beber2 categorias',
      'Cultura & lazer1 categoria',
    ])
    const food = families[0].closest('section') as HTMLElement
    expect(
      within(food)
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent)
    ).toEqual(['Bares', 'Cafés'])
    // The family is said by its heading, not repeated on every card.
    expect(within(food).getAllByText(/Comer & beber/)).toHaveLength(1)
  })

  it('keeps a flat list when the payload carries no family', () => {
    render(
      <CatalogCategories
        city_slug="londrina"
        catalog={{
          city: {
            slug: 'londrina',
            name: 'Londrina',
            state_code: 'PR',
            timezone: 'America/Sao_Paulo',
          },
          categories: [{ slug: 'bares', name: 'Bares', establishments_count: 2 }],
        }}
      />
    )

    expect(screen.getByRole('heading', { level: 3, name: 'Bares' })).toBeInTheDocument()
    expect(screen.queryByText('Outras categorias')).not.toBeInTheDocument()
  })
})
