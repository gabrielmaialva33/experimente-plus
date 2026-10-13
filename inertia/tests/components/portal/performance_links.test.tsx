import type { ComponentProps, ReactNode } from 'react'

import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { matchNavigationItem, resolveRouteMetadata } from '~/config/navigation'
import { pageHelp } from '~/config/help'
import OrganizationAnalytics from '~/pages/analytics/organization'
import PartnerPlacesPage from '~/pages/portal/establishments/index'
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

/** Every way into a place's "Desempenho", and where the Portal says the reader is. */
describe('Ways into the performance of a place', () => {
  it('gives each place of the list its own link when the role reads analytics', () => {
    render(
      <PartnerPlacesPage
        organizations={[
          {
            id: 4,
            name: 'Grupo Central',
            can_read_analytics: true,
            places: [
              { id: 8, name: 'Café Central', state: 'published', can_list_benefits: true },
              { id: 9, name: 'Café do Lago', state: 'draft', can_list_benefits: true },
            ],
          },
          {
            id: 5,
            name: 'Outra Rede',
            can_read_analytics: false,
            places: [{ id: 10, name: 'Bar do Porto', state: 'published', can_list_benefits: true }],
          },
        ]}
      />
    )

    expect(screen.getByRole('link', { name: 'Desempenho de Café Central' })).toHaveAttribute(
      'href',
      '/portal/establishments/8/performance'
    )
    expect(screen.getByRole('link', { name: 'Desempenho de Café do Lago' })).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'Desempenho de Bar do Porto' })
    ).not.toBeInTheDocument()
  })

  it('opens a place from its row in the organization numbers', () => {
    render(
      <OrganizationAnalytics
        dashboard={{
          organization_id: 4,
          from: '2026-09-01',
          to: '2026-09-07',
          totals: [],
          timeseries: [],
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
        }}
      />
    )

    const table = within(screen.getByRole('region', { name: 'Desempenho por lugar' }))
    expect(table.getByRole('link', { name: 'Café Central' })).toHaveAttribute(
      'href',
      '/portal/establishments/8/performance'
    )
    const cards = within(screen.getByRole('list', { name: 'Desempenho por lugar' }))
    expect(cards.getByRole('link', { name: 'Café Central' })).toHaveAttribute(
      'href',
      '/portal/establishments/8/performance'
    )
  })

  it('keeps "Desempenho" lit in the menu and names the page for its help', () => {
    const url = '/portal/establishments/8/performance?period=last_90_days'

    expect(matchNavigationItem(url)?.id).toBe('portal-performance')
    expect(resolveRouteMetadata(url)?.id).toBe('portal-establishment-performance')
    expect(pageHelp('portal/establishments/performance', 'portal').href).toBe(
      '/manual#parceiro-desempenho-negocio'
    )
    // The place's own data page is still "Dados do lugar".
    expect(matchNavigationItem('/portal/establishments/8')?.id).toBe('portal-establishments')
  })
})
