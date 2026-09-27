import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConsumerShell } from '~/components/consumer/consumer_shell'
import { PublicErrorShell } from '~/components/public/public_error_shell'
import { PublicHeader } from '~/components/public/public_header'
import { PublicMobileNavigation } from '~/components/public/public_mobile_navigation'
import { PublicShell } from '~/components/public/public_shell'
import { render } from '~/tests/test_utils'

const pageState = vi.hoisted(() => ({
  url: '/',
  user: null as null | { id: number; full_name: string; email: string },
  activeTenantId: null as number | null,
}))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { post: vi.fn() },
  usePage: () => ({
    url: pageState.url,
    props: {
      app: {
        name: 'Experimente+',
        url: 'http://experimente.test',
        sourceUrl: null,
        environment: 'test',
        demoPagesEnabled: false,
      },
      auth: {
        user: pageState.user,
        tenants: [],
        activeTenantId: pageState.activeTenantId,
        hasActiveOrganizationMembership: false,
        platformAccess: null,
        permissions: [],
      },
    },
  }),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Alterar tema</button>,
}))

afterEach(() => {
  pageState.url = '/'
  pageState.user = null
  pageState.activeTenantId = null
})

const tailwindCss = readFileSync(resolve(process.cwd(), 'inertia/css/tailwind.config.css'), 'utf8')
const appCss = readFileSync(resolve(process.cwd(), 'inertia/css/app.css'), 'utf8')

describe('responsive chrome on short screens', () => {
  it('defines one short-viewport variant and shrinks the bottom navigation reserve with it', () => {
    expect(tailwindCss).toContain('@custom-variant short (@media (max-height: 30rem));')

    const media = appCss.indexOf('@media (max-height: 30rem) {')
    expect(media).toBeGreaterThan(-1)
    expect(appCss.slice(media, appCss.indexOf('}', media))).toContain(
      '--public-mobile-navigation-reserve: 3.75rem;'
    )
  })

  it('lets the sticky headers scroll away on a phone on its side', () => {
    const { unmount } = render(<PublicHeader />)
    expect(screen.getByRole('banner')).toHaveClass('sticky', 'short:static')
    unmount()

    pageState.user = { id: 7, full_name: 'Ana Souza', email: 'ana@example.com' }
    pageState.activeTenantId = 31
    render(
      <ConsumerShell>
        <h1>Carteira</h1>
      </ConsumerShell>
    )
    expect(screen.getByRole('banner')).toHaveClass('sticky', 'short:static')
  })

  it('turns both bottom navigations into compact bars with the label beside the icon', () => {
    pageState.url = '/cidades'
    const { unmount } = render(<PublicMobileNavigation />)
    const publicNavigation = screen.getByRole('navigation', { name: 'Navegação móvel' })
    for (const link of within(publicNavigation).getAllByRole('link')) {
      expect(link).toHaveClass('flex-col', 'short:flex-row', 'short:min-h-11')
    }
    unmount()

    pageState.user = { id: 7, full_name: 'Ana Souza', email: 'ana@example.com' }
    pageState.activeTenantId = 31
    pageState.url = '/wallet'
    render(
      <ConsumerShell>
        <h1>Carteira</h1>
      </ConsumerShell>
    )
    const walletNavigation = screen.getByRole('navigation', { name: 'Navegação principal' })
    for (const link of within(walletNavigation).getAllByRole('link')) {
      expect(link).toHaveClass('flex-col', 'short:flex-row', 'short:min-h-11')
    }
  })

  it('steps both phone tab bars aside while a text field has the keyboard', () => {
    const rule = appCss.indexOf('[data-mobile-tab-bar] {')
    expect(rule).toBeGreaterThan(-1)
    const prelude = appCss.slice(appCss.lastIndexOf('@media (max-width: 47.999rem)', rule), rule)
    expect(prelude).toContain('html:has(')
    expect(prelude).toContain('textarea')
    expect(prelude).toContain('):focus')
    expect(appCss.slice(rule, appCss.indexOf('}', rule))).toContain('display: none;')

    pageState.url = '/cidades'
    const { unmount } = render(<PublicMobileNavigation />)
    expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toHaveAttribute(
      'data-mobile-tab-bar'
    )
    unmount()

    pageState.user = { id: 7, full_name: 'Ana Souza', email: 'ana@example.com' }
    pageState.activeTenantId = 31
    render(
      <ConsumerShell>
        <h1>Carteira</h1>
      </ConsumerShell>
    )
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toHaveAttribute(
      'data-mobile-tab-bar'
    )
  })

  it('grows the header destinations to 44 px on a touch tablet', () => {
    pageState.url = '/cidades'
    const { unmount } = render(<PublicHeader />)
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Explorar' })).toHaveClass(
      'min-h-10',
      'pointer-coarse:min-h-11'
    )
    unmount()

    pageState.user = { id: 7, full_name: 'Ana Souza', email: 'ana@example.com' }
    pageState.activeTenantId = 31
    render(
      <ConsumerShell>
        <h1>Carteira</h1>
      </ConsumerShell>
    )
    const header = within(screen.getByRole('navigation', { name: 'Navegação do consumidor' }))
    for (const link of header.getAllByRole('link')) {
      expect(link).toHaveClass('pointer-coarse:min-h-11')
    }
  })

  it('wraps a long tab label on a 320 px phone instead of cutting it with an ellipsis', () => {
    pageState.url = '/cidades'
    render(<PublicMobileNavigation />)

    const label = screen.getByText('Cadastrar negócio')
    expect(label).toHaveClass('line-clamp-2', 'text-center')
    expect(label).not.toHaveClass('truncate')
  })

  it('sizes the public shells to the dynamic viewport, not the tallest one', () => {
    const { container, unmount } = render(
      <PublicShell title="Cidades" description="Descoberta pública">
        <p>Conteúdo</p>
      </PublicShell>
    )
    expect(container.querySelector('[data-public-shell]')).toHaveClass('min-h-dvh')
    expect(container.querySelector('[data-public-shell]')).not.toHaveClass('min-h-screen')
    unmount()

    render(
      <PublicErrorShell title="Página não encontrada" description="Endereço inexistente">
        <p>Conteúdo</p>
      </PublicErrorShell>
    )
    expect(screen.getByRole('main').parentElement).toHaveClass('min-h-dvh')
  })

  it('drops the brand tagline beside the wallet actions on a phone narrower than 360 px', () => {
    pageState.user = { id: 7, full_name: 'Ana Souza', email: 'ana@example.com' }
    pageState.activeTenantId = 31
    render(
      <ConsumerShell>
        <h1>Carteira</h1>
      </ConsumerShell>
    )

    expect(within(screen.getByRole('banner')).getByText('Descoberta regional')).toHaveClass(
      'max-[360px]:hidden'
    )
  })
})
