import type { ComponentProps, ReactNode } from 'react'

import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import OrganizationAnalytics from '~/pages/analytics/organization'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const dashboard = {
  organization_id: 4,
  from: '2026-09-01',
  to: '2026-09-07',
  totals: [
    { event_type: 'catalog_impression', event_count: 120, unique_sessions: 40 },
    { event_type: 'establishment_view', event_count: 30, unique_sessions: 20 },
    { event_type: 'whatsapp_click', event_count: 3, unique_sessions: 3 },
  ],
  timeseries: [
    { date: '2026-09-01', impressions: 60, views: 10, conversions: 1, unique_sessions: 12 },
    { date: '2026-09-02', impressions: 60, views: 20, conversions: 2, unique_sessions: 18 },
  ],
  establishments: [
    {
      establishment_id: 8,
      public_name: 'Café Central',
      slug: 'cafe-central',
      impressions: 120,
      views: 30,
      conversions: 3,
      unique_sessions: 20,
    },
  ],
}

describe('OrganizationAnalytics', () => {
  it('names the page for partners and explains what each chart color means', () => {
    render(<OrganizationAnalytics dashboard={dashboard} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Desempenho da descoberta' })
    ).toBeVisible()

    const legend = screen.getByRole('list', { name: 'Legenda do gráfico' })
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['Vezes que apareceu', 'Visitas à página', 'Contatos'])
    expect(screen.getByRole('img', { name: /Barras por dia com vezes que apareceu/ })).toBeVisible()
  })

  it('lists each place with its numbers under partner words', () => {
    render(<OrganizationAnalytics dashboard={dashboard} />)

    const table = within(screen.getByRole('region', { name: 'Desempenho por lugar' }))
    expect(table.getByRole('columnheader', { name: 'Lugar' })).toBeVisible()
    expect(table.getByRole('rowheader', { name: 'Café Central' })).toBeVisible()
    expect(screen.getByText('10% das visitas')).toBeVisible()
  })

  it('gives a phone one card per place instead of a sideways-scrolling table', () => {
    render(<OrganizationAnalytics dashboard={dashboard} />)

    // JSDOM ignores the breakpoints: both exist, and the classes pick one per width.
    const cards = screen.getByRole('list', { name: 'Desempenho por lugar' })
    expect(cards).toHaveClass('sm:hidden')
    expect(screen.getByRole('region', { name: 'Desempenho por lugar' })).toHaveClass(
      'hidden',
      'sm:block'
    )
    const card = within(within(cards).getAllByRole('listitem')[0])
    expect(card.getByText('Café Central')).toBeInTheDocument()
    expect(card.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Apareceu',
      'Visitas',
      'Contatos',
      'Sessões',
    ])
  })
})
