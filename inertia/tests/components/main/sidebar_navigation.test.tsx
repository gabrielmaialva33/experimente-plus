import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { SidebarNav } from '~/layouts/main/components/sidebar'
import { render, screen } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  url: '/portal',
  activeTenantId: 7 as number | null,
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
        permissions: mocks.permissions,
        tenants: [{ id: 7, name: 'Operação Norte', role: 'admin' }],
      },
    },
  }),
}))

describe('SidebarNav', () => {
  it('renders only Portal destinations allowed by the current capabilities', () => {
    mocks.url = '/portal/redemptions'
    mocks.activeTenantId = 7
    mocks.permissions = ['benefit_offers.read', 'dashboard.read']

    render(<SidebarNav surface="portal" />)

    expect(screen.getByRole('navigation', { name: 'Navegação — Portal do parceiro' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Visão geral' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Utilizações' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.queryByText('Painel operacional')).not.toBeInTheDocument()
  })

  it('renders only permitted Backoffice destinations and keeps the specific active state', () => {
    mocks.url = '/backoffice/moderation/45'
    mocks.activeTenantId = 7
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

  it('shows the edition workspace to update-only operators', () => {
    mocks.url = '/backoffice/benefits'
    mocks.activeTenantId = 7
    mocks.permissions = ['benefit_editions.update']

    render(<SidebarNav surface="backoffice" />)

    expect(screen.getByRole('link', { name: 'Edições e benefícios' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('hides operation-bound destinations without an active operation', () => {
    mocks.url = '/users'
    mocks.activeTenantId = null
    mocks.permissions = ['establishments.list', 'users.list']

    render(<SidebarNav surface="backoffice" />)

    expect(screen.queryByText('Fila de moderação')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('aria-current', 'page')
  })
})
