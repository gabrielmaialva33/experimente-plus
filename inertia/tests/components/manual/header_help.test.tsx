import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Header } from '~/layouts/main/components/header'
import { render, screen } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  router: { post: vi.fn() },
  usePage: () => ({ url: '/backoffice/reports', component: 'backoffice/reports/index', props: {} }),
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({
    user: { id: 1, full_name: 'Operadora Demo', email: 'operadora@example.test' },
    tenants: [],
    activeTenant: null,
    activeTenantId: 1,
    hasActiveOrganizationMembership: false,
    platformAccess: 'platform_admin',
    permissions: [],
    can: () => true,
  }),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Tema</button>,
}))

vi.mock('~/layouts/main/components/sidebar', () => ({
  SidebarNav: () => <nav>Destinos disponíveis</nav>,
}))

describe('Header help', () => {
  it('puts the help menu in the portal and back-office header, at the current page', async () => {
    const { user } = render(<Header surface="backoffice" />)

    await user.click(screen.getByRole('button', { name: 'Ajuda' }))

    expect(screen.getByRole('menuitem', { name: /Ajuda desta página/ })).toHaveAttribute(
      'href',
      '/manual#administracao-denuncias'
    )
  })
})
