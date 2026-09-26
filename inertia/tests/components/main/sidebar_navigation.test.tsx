import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarNav } from '~/layouts/main/components/sidebar'
import { render, screen } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  url: '/portal',
  activeTenantId: 7 as number | null,
  platformAccess: null as 'platform_admin' | 'platform_moderator' | null,
  permissions: [] as string[],
}))

vi.mock('@inertiajs/react', () => ({
  Link: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => ({
    url: mocks.url,
    props: {
      app: { demoPagesEnabled: false },
      auth: {
        activeTenantId: mocks.activeTenantId,
        platformAccess: mocks.platformAccess,
        permissions: mocks.permissions,
        tenants: [{ id: 7, name: 'Operação Norte', role: 'admin' }],
      },
    },
  }),
}))

describe('SidebarNav', () => {
  beforeEach(() => {
    mocks.url = '/portal'
    mocks.activeTenantId = 7
    mocks.platformAccess = null
    mocks.permissions = []
  })

  it('lists the partner day-to-day destinations the permissions allow, marking the current one', () => {
    mocks.url = '/portal/redemptions'
    mocks.activeTenantId = 7
    mocks.permissions = ['benefit_offers.read', 'dashboard.read']

    render(<SidebarNav surface="portal" />)

    expect(screen.getByRole('navigation', { name: 'Navegação — Portal do parceiro' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Utilizações' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    // Validating needs benefit_offers.update, which this partner does not have.
    expect(screen.queryByRole('link', { name: 'Validar benefício' })).not.toBeInTheDocument()
    expect(screen.queryByText('Painel operacional')).not.toBeInTheDocument()
  })

  it('marks the Portal overview only on its exact destination', () => {
    mocks.url = '/portal'
    mocks.activeTenantId = 7
    mocks.permissions = ['benefit_offers.read']

    render(<SidebarNav surface="portal" />)

    expect(screen.getByRole('link', { name: 'Visão geral' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('shows the cross-organization content workspace only with establishment read access', () => {
    mocks.url = '/portal/content'
    mocks.permissions = ['establishments.read']

    render(<SidebarNav surface="portal" />)

    expect(screen.getByRole('link', { name: 'Experiências e eventos' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute('aria-current')
  })

  it('renders only permitted Backoffice destinations and keeps the specific active state', () => {
    mocks.url = '/backoffice/moderation/45'
    mocks.activeTenantId = 7
    mocks.platformAccess = 'platform_moderator'
    mocks.permissions = ['establishments.list', 'benefit_accesses.list']

    render(<SidebarNav surface="backoffice" />)

    expect(screen.getByRole('link', { name: 'Dados de lugares' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', { name: 'Acessos a edições' })).toBeVisible()
    // The queues read as one inbox (direction A naming).
    expect(screen.getByText('Caixa de moderação')).toBeVisible()
    expect(screen.queryByText('Visão geral')).not.toBeInTheDocument()
    expect(screen.queryByText('Edições e benefícios')).not.toBeInTheDocument()
  })

  it('shows the edition workspace to read-only operation moderators', () => {
    mocks.url = '/backoffice/benefits'
    mocks.activeTenantId = 7
    mocks.platformAccess = 'platform_moderator'
    mocks.permissions = ['benefit_editions.list']

    render(<SidebarNav surface="backoffice" />)

    expect(screen.getByRole('link', { name: 'Edições e benefícios' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('marks partner content as its own Backoffice destination', () => {
    mocks.url = '/backoffice/content'
    mocks.platformAccess = 'platform_moderator'
    mocks.permissions = ['establishments.list']

    render(<SidebarNav surface="backoffice" />)

    expect(screen.getByRole('link', { name: 'Conteúdo de parceiros' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', { name: 'Dados de lugares' })).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('keeps every Backoffice destination hidden from a USER with shared permissions', () => {
    mocks.url = '/dashboard'
    mocks.activeTenantId = 7
    mocks.permissions = ['benefit_editions.list', 'benefit_accesses.list', 'establishments.list']

    render(<SidebarNav surface="backoffice" />)

    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryByText('Operação')).not.toBeInTheDocument()
  })

  it('hides operation-bound destinations without an active operation', () => {
    mocks.url = '/users'
    mocks.activeTenantId = null
    mocks.platformAccess = 'platform_admin'
    mocks.permissions = ['establishments.list', 'users.list']

    render(<SidebarNav surface="backoffice" />)

    expect(screen.queryByText('Dados de lugares')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Pessoas e acesso')).toBeVisible()
  })

  it('draws the sidebar on the authenticated chrome, the current item as a light plate', () => {
    mocks.url = '/portal'
    mocks.permissions = ['benefit_offers.read']

    render(<SidebarNav surface="portal" />)

    const current = screen.getByRole('link', { name: 'Visão geral' })
    expect(current).toHaveClass('bg-chrome-active', 'text-chrome-active-foreground', 'font-bold')
    expect(current).toHaveClass('min-h-11')
    const other = screen.getByRole('link', { name: 'Utilizações' })
    expect(other).toHaveClass('text-chrome-foreground', 'hover:bg-chrome-hover')
    expect(other).not.toHaveClass('bg-chrome-active')
  })
})
