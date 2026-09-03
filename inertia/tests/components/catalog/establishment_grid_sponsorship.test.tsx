import { Link } from '@inertiajs/react'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import EstablishmentGrid from '~/components/catalog/establishment_grid'
import type { CatalogSearchItem } from '~/lib/catalog'
import { render } from '~/tests/test_utils'

const entry: CatalogSearchItem = {
  slug: 'cafe-aurora',
  name: 'Café Aurora',
  shortDescription: 'Café especial no centro.',
  citySlug: 'cornelio-procopio',
  cityName: 'Cornélio Procópio',
  stateCode: 'PR',
  district: 'Centro',
  businessStatus: 'open',
  isOpenNow: true,
  primaryCategory: null,
  categories: [],
  cover: null,
  isSponsored: true,
}

describe('EstablishmentGrid sponsorship', () => {
  beforeEach(() => {
    vi.mocked(Link).mockClear()
  })

  it('labels paid placement explicitly', () => {
    render(<EstablishmentGrid entries={[entry]} citySlug="cornelio-procopio" />)

    expect(screen.getByText('Patrocinado')).toBeInTheDocument()
    expect(screen.queryByText('Destaque')).not.toBeInTheDocument()
  })

  it('does not label an organic establishment as sponsored', () => {
    render(
      <EstablishmentGrid
        entries={[{ ...entry, slug: 'cafe-organico', isSponsored: false }]}
        citySlug="cornelio-procopio"
      />
    )

    expect(screen.queryByText('Patrocinado')).not.toBeInTheDocument()
  })

  it('uses one predictable detail destination for the whole card', () => {
    render(<EstablishmentGrid entries={[entry]} citySlug="cornelio-procopio" />)

    expect(Link).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Link).mock.calls[0]?.[0]).toMatchObject({
      'href': '/cidades/cornelio-procopio/estabelecimentos/cafe-aurora',
      'aria-labelledby': 'establishment-sponsored-cafe-aurora',
      'aria-describedby':
        'establishment-sponsored-cafe-aurora-sponsorship establishment-sponsored-cafe-aurora-status',
    })
  })

  it('uses the canonical empty state when no establishment matches', () => {
    const { container } = render(
      <EstablishmentGrid
        entries={[]}
        citySlug="cornelio-procopio"
        emptyTitle="Nenhum resultado"
        emptyMessage="Tente ajustar os filtros."
      />
    )

    expect(container.querySelector('[data-slot="empty-state"]')).toBeInTheDocument()
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument()
    expect(screen.getByText('Tente ajustar os filtros.')).toBeInTheDocument()
    expect(Link).not.toHaveBeenCalled()
  })
})
