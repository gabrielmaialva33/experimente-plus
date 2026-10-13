import type { ComponentProps, ReactNode } from 'react'

import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { EstablishmentPerformance } from '~/lib/performance'
import EstablishmentPerformancePage from '~/pages/portal/establishments/performance'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({
    href,
    children,
    preserveScroll: _preserveScroll,
    ...props
  }: ComponentProps<'a'> & { preserveScroll?: boolean }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const zero = { current: 0, previous: 0 }

function props(overrides: Partial<EstablishmentPerformance> = {}): EstablishmentPerformance {
  return {
    establishment: {
      id: 8,
      name: 'Café Central',
      organization_id: 4,
      organization_name: 'Grupo Central',
      published: true,
    },
    period: {
      key: 'current_month',
      from: '2026-10-01',
      to: '2026-10-13',
      previous_from: '2026-09-01',
      previous_to: '2026-09-13',
      days: 13,
      previous_days: 13,
    },
    periods: ['current_month', 'previous_month', 'last_90_days'],
    edition: null,
    metrics: {
      impressions: { current: 120, previous: 80 },
      views: { current: 30, previous: 40 },
      clicks: [
        { channel: 'route', published: true, current: 4, previous: 2 },
        { channel: 'whatsapp', published: true, current: 6, previous: 0 },
        { channel: 'phone', published: true, current: 1, previous: 1 },
        { channel: 'website', published: false, current: 0, previous: 0 },
      ],
      new_followers: { current: 5, previous: 2 },
      new_favorites: { current: 3, previous: 3 },
      redemptions: { current: 12, previous: 8 },
      reviews: { count: { current: 4, previous: 2 }, average: { current: 4.5, previous: 4 } },
    },
    estimate: {
      status: 'available',
      average_ticket_cents: 4250,
      current_cents: 51000,
      previous_cents: 34000,
    },
    trend: [
      { date: '2026-10-01', impressions: 60, views: 10, clicks: 2 },
      { date: '2026-10-02', impressions: 60, views: 20, clicks: 9 },
    ],
    ...overrides,
  }
}

function stat(name: string) {
  return within(screen.getByRole('article', { name }))
}

describe('Establishment performance page', () => {
  it('names the place and the period, and marks the period chosen', () => {
    render(<EstablishmentPerformancePage {...props()} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Café Central' })).toBeVisible()
    const periods = within(screen.getByRole('navigation', { name: 'Período' }))
    expect(periods.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Este mês',
      'Mês passado',
      'Últimos 90 dias',
    ])
    expect(periods.getByRole('link', { name: 'Este mês' })).toHaveAttribute('aria-current', 'page')
    expect(periods.getByRole('link', { name: 'Últimos 90 dias' })).toHaveAttribute(
      'href',
      '/portal/establishments/8/performance?period=last_90_days'
    )
    expect(screen.getByText('1 a 13 de out. de 2026')).toBeVisible()
    expect(
      screen.getByText(/Comparado com 1 a 13 de set\. de 2026, os mesmos dias do mês anterior\./)
    ).toBeVisible()
    expect(screen.getByRole('link', { name: /Dados do lugar/ })).toHaveAttribute(
      'href',
      '/portal/establishments/8'
    )
    expect(screen.getByRole('link', { name: /Desempenho da organização/ })).toHaveAttribute(
      'href',
      '/organizations/4/analytics'
    )
  })

  it('shows each number with its change in words a screen reader reads', () => {
    render(<EstablishmentPerformancePage {...props()} />)

    const used = stat('Benefícios utilizados')
    expect(used.getByText('12')).toBeVisible()
    expect(
      used.getByText('Aumento de 50% em relação ao período anterior, que teve 8.')
    ).toHaveClass('sr-only')

    expect(stat('Aparições na busca').getByText('120')).toBeVisible()
    expect(stat('Visitas à página do lugar').getByText(/Queda de 25%/)).toBeInTheDocument()
    expect(stat('Novos seguidores').getByText('5')).toBeVisible()
    expect(stat('Novos favoritos').getByText(/Igual ao período anterior/)).toBeInTheDocument()
    expect(stat('Cliques no WhatsApp').getByText(/o período anterior teve 0/)).toBeInTheDocument()

    const reviews = stat('Avaliações recebidas')
    expect(reviews.getByText('4')).toBeVisible()
    expect(reviews.getByText('Nota média 4,5 de 5')).toBeVisible()
    expect(reviews.getByText(/Subiu 0,5 ponto/)).toBeInTheDocument()
  })

  it('labels the sale as an estimate and explains how it is made', () => {
    render(<EstablishmentPerformancePage {...props()} />)

    const estimate = stat('Venda estimada')
    expect(estimate.getByText(/^R\$\s510$/)).toBeVisible()
    expect(
      estimate.getByText(
        /Estimativa: benefícios utilizados × ticket médio de R\$\s42,50 informado pelo lugar\. Não é o faturamento real\./
      )
    ).toBeVisible()
  })

  it('asks for the ticket instead of showing a number when the place has none', () => {
    render(
      <EstablishmentPerformancePage
        {...props({ estimate: { status: 'missing', field_available: true } })}
      />
    )

    const estimate = stat('Venda estimada')
    expect(estimate.queryByText(/R\$/)).not.toBeInTheDocument()
    expect(estimate.getByText(/Preencha o ticket médio nos dados do lugar/)).toBeVisible()
    expect(estimate.getByRole('link', { name: 'Preencher o ticket médio' })).toHaveAttribute(
      'href',
      '/portal/establishments/8#attributes'
    )
  })

  it('does not offer a field the category lacks, and waits for a ticket under review', () => {
    const { unmount } = render(
      <EstablishmentPerformancePage
        {...props({ estimate: { status: 'missing', field_available: false } })}
      />
    )
    expect(stat('Venda estimada').getByText(/ainda não tem o campo Ticket médio/)).toBeVisible()
    expect(
      stat('Venda estimada').queryByRole('link', { name: 'Preencher o ticket médio' })
    ).not.toBeInTheDocument()
    unmount()

    render(<EstablishmentPerformancePage {...props({ estimate: { status: 'pending_review' } })} />)
    expect(
      stat('Venda estimada').getByText(/entra na conta quando a nova versão dos dados/)
    ).toBeVisible()
  })

  it('says when nothing happened yet instead of an empty chart', () => {
    const quiet = props()
    render(
      <EstablishmentPerformancePage
        {...quiet}
        metrics={{
          ...quiet.metrics,
          impressions: zero,
          views: zero,
          clicks: quiet.metrics.clicks.map((click) => ({ ...click, ...zero })),
          new_followers: zero,
          new_favorites: zero,
          redemptions: zero,
          reviews: { count: zero, average: { current: null, previous: null } },
        }}
        trend={[{ date: '2026-10-01', impressions: 0, views: 0, clicks: 0 }]}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('Ainda não há movimento neste período.')
    expect(screen.getByText('Nenhuma visita à página do lugar neste período.')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(
      stat('Benefícios utilizados').getByText('Sem registros neste período nem no anterior.')
    ).toBeInTheDocument()
    expect(stat('Avaliações recebidas').getByText('Sem nota média no período')).toBeVisible()
  })

  it('warns that an unpublished place does not count yet', () => {
    const base = props()
    render(
      <EstablishmentPerformancePage
        {...base}
        establishment={{ ...base.establishment, published: false }}
      />
    )

    expect(screen.getByRole('note')).toHaveTextContent('Este lugar ainda não está publicado.')
  })

  it('tells a contact the place does not show apart from one nobody used', () => {
    render(<EstablishmentPerformancePage {...props()} />)

    const website = stat('Cliques no site')
    expect(website.getByText('—')).toBeVisible()
    expect(website.getByText('Este contato não aparece na página do lugar.')).toBeVisible()
    expect(stat('Cliques no telefone').getByText('1')).toBeVisible()
  })

  it('offers the edition while one runs and names it when chosen', () => {
    render(
      <EstablishmentPerformancePage
        {...props({
          periods: ['current_month', 'previous_month', 'last_90_days', 'current_edition'],
          edition: {
            name: 'Experimente+ Primavera',
            starts_on: '2026-10-04',
            ends_on: '2026-12-31',
          },
          period: {
            key: 'current_edition',
            from: '2026-10-04',
            to: '2026-10-13',
            previous_from: '2026-09-24',
            previous_to: '2026-10-03',
            days: 10,
            previous_days: 10,
          },
        })}
      />
    )

    expect(screen.getByRole('link', { name: 'Edição atual' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByText(/Experimente\+ Primavera/)).toBeVisible()
    expect(screen.getByText(/Comparado com 24 de set\. a 3 de out\. de 2026\./)).toBeVisible()
  })

  it('summarizes the daily chart for screen readers', () => {
    render(<EstablishmentPerformancePage {...props()} />)

    expect(
      screen.getByRole('img', {
        name: 'Visitas à página por dia: 30 no período, com o maior número em 2 out. (20).',
      })
    ).toBeInTheDocument()
  })

  it('keeps two numbers per row on a phone', () => {
    render(<EstablishmentPerformancePage {...props()} />)

    const discovery = screen.getByRole('region', { name: 'Descoberta' })
    expect(discovery.querySelector('.grid')).toHaveClass('grid-cols-2')
  })
})
