import type { ComponentProps, ReactNode } from 'react'

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import DashboardPage, { greetingFor } from '~/pages/dashboard'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({ permissions: [] as string[] }))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({
    user: { full_name: 'Ana Souza' },
    activeTenant: { id: 7, name: 'Norte' },
    can: (permission: string) => mocks.permissions.includes(permission),
  }),
}))

vi.mock('~/layouts', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

// The charts are not what this test reads.
vi.mock('~/components/ui/chart', () => ({
  ChartContainer: () => null,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}))

const stats = {
  totals: { users: 3, tenants: 1, files: 0, roles: 5 },
  signups: [{ month: 'Set', users: 1 }],
  recentUsers: [],
}

describe('DashboardPage', () => {
  // Audit W30: greet by the hour in Brasília, and never "Olá, por aqui".
  it('greets by the hour in Brasília', () => {
    expect(greetingFor('Ana Souza', new Date('2026-09-26T12:00:00Z'))).toBe('Bom dia, Ana')
    expect(greetingFor('Ana Souza', new Date('2026-09-26T18:00:00Z'))).toBe('Boa tarde, Ana')
    expect(greetingFor(undefined, new Date('2026-09-27T01:00:00Z'))).toBe('Boa noite')
  })

  // Audit W13: the daily work starts on "Hoje".
  it('points someone who moderates to Hoje', () => {
    mocks.permissions = ['establishments.list']
    render(<DashboardPage stats={stats} />)

    expect(screen.getByRole('heading', { name: 'O que pede atenção hoje' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Abrir Hoje' })).toHaveAttribute(
      'href',
      '/backoffice/today'
    )
  })

  // The band is chrome, not the action blue: `primary` turns light blue in the dark theme.
  it('paints the Hoje band with the navy chrome in both themes', () => {
    mocks.permissions = ['establishments.list']
    render(<DashboardPage stats={stats} />)

    const band = screen.getByRole('region', { name: 'O que pede atenção hoje' })
    expect(band).toHaveClass('bg-chrome', 'text-chrome-foreground')
    expect(band).not.toHaveClass('bg-primary')
  })

  it('leaves Hoje out for someone who cannot open it', () => {
    mocks.permissions = []
    render(<DashboardPage stats={stats} />)

    expect(screen.queryByRole('link', { name: 'Abrir Hoje' })).not.toBeInTheDocument()
  })
})
