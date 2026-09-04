import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Header } from '~/layouts/main/components/header'
import { render, screen } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  router: { post: vi.fn() },
  usePage: () => ({ url: '/portal', props: {} }),
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({
    user: null,
    tenants: [],
    activeTenant: null,
    activeTenantId: null,
    can: () => false,
  }),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Tema</button>,
}))

vi.mock('~/layouts/main/components/sidebar', () => ({
  SidebarNav: () => <nav>Destinos disponíveis</nav>,
}))

describe('Header mobile navigation', () => {
  it('opens an accessible drawer with localized close and safe-area spacing', async () => {
    const { user } = render(<Header surface="portal" />)

    await user.click(screen.getByRole('button', { name: 'Abrir navegação' }))

    const drawer = screen.getByRole('dialog', { name: 'Navegação principal' })
    expect(drawer).toHaveAccessibleDescription(/áreas disponíveis no portal do parceiro/i)
    expect(drawer).toHaveClass('pt-[env(safe-area-inset-top)]', 'pb-[env(safe-area-inset-bottom)]')
    expect(screen.getByRole('button', { name: 'Fechar navegação' })).toBeVisible()
  })
})
