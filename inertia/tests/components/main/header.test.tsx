import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Header } from '~/layouts/main/components/header'
import { render, screen } from '~/tests/test_utils'

const authState = vi.hoisted(() => ({
  user: null as { id: number; full_name: string; email: string } | null,
  tenants: [] as Array<{ id: number; name: string; role: string | null }>,
  activeTenant: null as { id: number; name: string; role: string | null } | null,
  activeTenantId: null as number | null,
  platformAccess: null as 'platform_admin' | 'platform_moderator' | null,
  permissions: [] as string[],
}))

vi.mock('@inertiajs/react', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  router: { post: vi.fn() },
  usePage: () => ({ url: '/portal', props: {} }),
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({
    ...authState,
    can: (permission: string) => authState.permissions.includes(permission),
  }),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Tema</button>,
}))

vi.mock('~/layouts/main/components/sidebar', () => ({
  SidebarNav: () => <nav>Destinos disponíveis</nav>,
}))

describe('Header mobile navigation', () => {
  beforeEach(() => {
    authState.user = null
    authState.tenants = []
    authState.activeTenant = null
    authState.activeTenantId = null
    authState.platformAccess = null
    authState.permissions = []
  })

  it('opens an accessible drawer with localized close and safe-area spacing', async () => {
    const { user } = render(<Header surface="portal" />)

    await user.click(screen.getByRole('button', { name: 'Abrir navegação' }))

    const drawer = screen.getByRole('dialog', { name: 'Navegação principal' })
    expect(drawer).toHaveAccessibleDescription(/áreas disponíveis no portal do parceiro/i)
    expect(drawer).toHaveClass('pt-[env(safe-area-inset-top)]', 'pb-[env(safe-area-inset-bottom)]')
    expect(screen.getByRole('button', { name: 'Fechar navegação' })).toBeVisible()
  })

  it('hides the operation surface from a USER with shared Portal permissions', async () => {
    authState.user = { id: 1, full_name: 'Parceira Local', email: 'parceira@example.test' }
    authState.activeTenantId = 7
    authState.activeTenant = { id: 7, name: 'Operação Norte', role: 'member' }
    authState.tenants = [authState.activeTenant]
    authState.permissions = ['establishments.list', 'benefit_editions.list']

    const { user } = render(<Header surface="portal" />)
    await user.click(screen.getByRole('button', { name: 'Abrir menu do usuário' }))

    expect(screen.queryByRole('link', { name: 'Operação' })).not.toBeInTheDocument()
  })

  it('shows the first permitted operation destination to a platform moderator', async () => {
    authState.user = { id: 2, full_name: 'Moderadora', email: 'moderadora@example.test' }
    authState.activeTenantId = 7
    authState.activeTenant = { id: 7, name: 'Operação Norte', role: null }
    authState.tenants = [authState.activeTenant]
    authState.platformAccess = 'platform_moderator'
    authState.permissions = ['benefit_editions.list']

    const { user } = render(<Header surface="portal" />)
    await user.click(screen.getByRole('button', { name: 'Abrir menu do usuário' }))

    expect(screen.getByRole('link', { name: 'Operação' })).toHaveAttribute(
      'href',
      '/backoffice/benefits'
    )
  })
})
