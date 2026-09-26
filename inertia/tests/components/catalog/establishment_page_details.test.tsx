import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import CatalogEstablishment from '~/pages/catalog/establishment'

vi.mock('~/components/catalog/catalog_shell', () => ({
  default: ({ children, description }: { children: ReactNode; description: string }) => (
    <main>
      <p data-testid="shell-description">{description}</p>
      {children}
    </main>
  ),
}))

vi.mock('~/components/catalog/use_catalog_analytics', () => ({
  useEstablishmentViewAnalytics: vi.fn(),
}))

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { post: vi.fn() },
  usePage: () => ({ url: '/', props: {} }),
}))

const catalog = {
  slug: 'cafe-aurora',
  name: 'Café Aurora',
  short_description: 'Cafeteria de bairro com cafés especiais.',
  description: 'O Café Aurora reúne cafés especiais e confeitaria artesanal.',
  city: { slug: 'cornelio-procopio', name: 'Cornélio Procópio', timezone: 'America/Sao_Paulo' },
  business_status: 'open',
  availability_type: 'regular_hours',
  is_open_now: false,
  opening_hours: {
    weekly: [],
    special_days: [
      { date: '2026-12-25', status: 'closed', note: 'Fechado no feriado de Natal', intervals: [] },
    ],
  },
  attributes: [
    {
      key: 'average_ticket',
      name: 'Ticket médio',
      type: 'decimal',
      unit: 'BRL',
      value: 42.5,
      options: [],
    },
  ],
}

describe('place page details', () => {
  it('says the summary once: the header reads it and the card keeps the description', () => {
    render(<CatalogEstablishment city_slug="cornelio-procopio" catalog={catalog} />)

    expect(screen.getByTestId('shell-description')).toHaveTextContent(catalog.short_description)
    expect(screen.getAllByText(catalog.short_description)).toHaveLength(1)
    expect(screen.getByText(catalog.description)).toBeInTheDocument()
  })

  it('keeps a special date note apart from its hours', () => {
    render(<CatalogEstablishment city_slug="cornelio-procopio" catalog={catalog} />)

    const note = screen.getByText('Fechado no feriado de Natal')
    const row = note.closest('div') as HTMLElement
    expect(within(row).getByText('25 de dezembro de 2026')).toBeInTheDocument()
    expect(within(row).getByText('Fechado')).toBeInTheDocument()
    expect(row).not.toHaveTextContent('Fechado — Fechado')
  })

  it('reads a currency attribute in reais', () => {
    render(<CatalogEstablishment city_slug="cornelio-procopio" catalog={catalog} />)

    expect(screen.getByText('R$ 42,50')).toBeInTheDocument()
    expect(screen.queryByText(/42\.5 BRL/)).not.toBeInTheDocument()
  })
})
