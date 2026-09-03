import { Link } from '@inertiajs/react'
import { screen } from '@testing-library/react'
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
})
