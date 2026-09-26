import { Link } from '@inertiajs/react'
import { screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CatalogShell from '~/components/catalog/catalog_shell'
import { render } from '~/tests/test_utils'

vi.mock('~/components/public', () => ({
  PublicShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

describe('CatalogShell', () => {
  beforeEach(() => {
    vi.mocked(Link).mockClear()
  })

  it('identifies the selected city section without changing its canonical route', () => {
    render(
      <CatalogShell
        title="Categorias em Cornélio Procópio"
        description="Escolha uma categoria."
        citySlug="cornelio-procopio"
        activeSection="categories"
      >
        <p>Conteúdo</p>
      </CatalogShell>
    )

    const links = vi.mocked(Link).mock.calls.map(([props]) => props)
    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: '/cidades/cornelio-procopio' }),
        expect.objectContaining({
          'href': '/cidades/cornelio-procopio/categorias',
          'aria-current': 'location',
        }),
      ])
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Categorias em Cornélio Procópio'
    )
  })

  it('draws the trail without check marks and marks only the current page (W83)', () => {
    render(
      <CatalogShell
        title="Bar Estação 43"
        description="Bar regional."
        breadcrumbs={[
          { label: 'Cidades', href: '/cidades' },
          { label: 'Londrina', href: '/cidades/londrina' },
          { label: 'Bar Estação 43' },
        ]}
      >
        <p>Conteúdo</p>
      </CatalogShell>
    )

    const trail = screen.getByRole('navigation', { name: 'Caminho de navegação' })
    // A trail is not a set of choices: the only icons are the separators.
    expect(trail.querySelectorAll('.choice-marker, .lucide-check')).toHaveLength(0)
    expect(trail.querySelectorAll('svg')).toHaveLength(2)
    expect(within(trail).getByRole('link', { name: 'Londrina' })).toHaveAttribute(
      'href',
      '/cidades/londrina'
    )
    expect(within(trail).getByText('Bar Estação 43')).toHaveAttribute('aria-current', 'page')
    expect(trail.querySelectorAll('[aria-current]')).toHaveLength(1)
  })
})
