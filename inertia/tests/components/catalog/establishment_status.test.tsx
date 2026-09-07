import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import EstablishmentGrid from '~/components/catalog/establishment_grid'
import { EstablishmentStatus } from '~/components/catalog/establishment_status'
import type { CatalogAvailability, CatalogBusinessStatus, CatalogSearchItem } from '~/lib/catalog'
import CatalogEstablishment from '~/pages/catalog/establishment'

vi.mock('~/components/catalog/catalog_shell', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

vi.mock('~/components/catalog/use_catalog_analytics', () => ({
  useEstablishmentViewAnalytics: vi.fn(),
}))

const cases: Array<{
  businessStatus: CatalogBusinessStatus
  isOpenNow: boolean
  availabilityType?: CatalogAvailability
  label: string
  tone: string
}> = [
  { businessStatus: 'open', isOpenNow: true, label: 'Aberto agora', tone: 'bg-success-soft' },
  {
    businessStatus: 'open',
    isOpenNow: false,
    availabilityType: 'regular_hours',
    label: 'Fechado agora',
    tone: 'bg-muted',
  },
  {
    businessStatus: 'open',
    isOpenNow: false,
    availabilityType: 'always_open',
    label: 'Fechado agora',
    tone: 'bg-muted',
  },
  {
    businessStatus: 'open',
    isOpenNow: false,
    availabilityType: 'appointment_only',
    label: 'Somente com agendamento',
    tone: 'bg-info-soft',
  },
  {
    businessStatus: 'open',
    isOpenNow: false,
    label: 'Consulte o atendimento',
    tone: 'bg-muted',
  },
  {
    businessStatus: 'temporarily_closed',
    isOpenNow: true,
    availabilityType: 'appointment_only',
    label: 'Fechado temporariamente',
    tone: 'bg-warning-soft',
  },
  {
    businessStatus: 'permanently_closed',
    isOpenNow: true,
    label: 'Encerrado permanentemente',
    tone: 'bg-muted',
  },
]

describe('public establishment availability', () => {
  it.each(cases)('presents $label without inferring opening hours', ({ label, tone, ...props }) => {
    render(<EstablishmentStatus {...props} />)
    expect(screen.getByText(label)).toHaveClass(tone)
  })

  it('keeps uncertain search availability in the accessible card description', () => {
    const entry: CatalogSearchItem = {
      slug: 'cafe',
      name: 'Café',
      shortDescription: null,
      citySlug: 'londrina',
      cityName: 'Londrina',
      stateCode: 'PR',
      district: null,
      businessStatus: 'open',
      isOpenNow: false,
      primaryCategory: null,
      categories: [],
      cover: null,
      isSponsored: false,
    }

    render(<EstablishmentGrid entries={[entry]} citySlug="londrina" />)
    expect(screen.getByText('Consulte o atendimento')).toHaveAttribute(
      'id',
      'establishment-organic-cafe-status'
    )
    expect(screen.queryByText('Fechado agora')).not.toBeInTheDocument()
  })

  it('uses appointment information in the detail instead of claiming it is closed', () => {
    render(
      <CatalogEstablishment
        city_slug="londrina"
        catalog={{
          slug: 'estudio',
          name: 'Estúdio',
          city: { slug: 'londrina', name: 'Londrina', timezone: 'America/Sao_Paulo' },
          business_status: 'open',
          availability_type: 'appointment_only',
          is_open_now: false,
        }}
      />
    )

    expect(screen.getAllByText('Somente com agendamento')[0]).toHaveClass('bg-info-soft')
    expect(screen.queryByText('Fechado agora')).not.toBeInTheDocument()
  })

  it('keeps permanent closure historical and without conversion actions', () => {
    render(
      <CatalogEstablishment
        city_slug="londrina"
        catalog={{
          slug: 'cafe',
          name: 'Café',
          city: { slug: 'londrina', name: 'Londrina' },
          business_status: 'permanently_closed',
          historical: true,
        }}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Este estabelecimento encerrou as atividades' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Entre em contato' })).not.toBeInTheDocument()
  })
})
