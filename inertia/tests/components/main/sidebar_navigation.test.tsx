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

  it('keeps organization-scoped Portal actions out of the global sidebar', () => {
    mocks.url = '/portal/redemptions'
    mocks.activeTenantId = 7
    mocks.permissions = ['benefit_offers.read', 'dashboard.read']

    render(<SidebarNav surface="portal" />)

    expect(screen.getByRole('navigation', { name: 'Navegação — Portal do parceiro' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('link', { name: 'Utilizações' })).not.toBeInTheDocument()
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

  it('renders only permitted Backoffice destinations and keeps the specific active state', () => {
    mocks.url = '/backoffice/moderation/45'
    mocks.activeTenantId = 7
    mocks.platformAccess = 'platform_moderator'
    mocks.permissions = ['establishments.list', 'benefit_accesses.list']

    render(<SidebarNav surface="backoffice" />)

    expect(screen.getByRole('link', { name: 'Fila de moderação' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', { name: 'Acessos a edições' })).toBeVisible()
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

    expect(screen.queryByText('Fila de moderação')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('aria-current', 'page')
  })
})
