import { readFileSync } from 'node:fs'

import { screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicHeader } from '~/components/public/public_header'
import { PublicMobileNavigation } from '~/components/public/public_mobile_navigation'
import { PublicShell } from '~/components/public/public_shell'
import Home from '~/pages/home'
import { render } from '~/tests/test_utils'

const pageState = vi.hoisted(() => ({
  url: '/',
  user: null as null | { id: number; full_name: string; email: string },
  activeTenantId: null as number | null,
}))

const inertia = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { post: inertia.post },
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
  inertia.post.mockReset()
})

describe('public discovery experience', () => {
  it('keeps the guest header compact and free of duplicate actions', () => {
    pageState.url = '/cidades/londrina'

    const { container } = render(<PublicHeader />)
    const header = screen.getByRole('banner')

    expect(within(header).getByRole('link', { name: 'Explorar' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(header).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(within(header).getByRole('button', { name: 'Alterar tema' })).toBeEnabled()
    expect(within(header).queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('a[href="/register"]')).toHaveLength(0)
    expect(container.querySelectorAll('a[href="/cidades"]')).toHaveLength(1)
  })

  it('shows only distinct authenticated destinations in the public header', () => {
    pageState.url = '/wallet'
    pageState.user = { id: 7, full_name: 'Ana Souza', email: 'ana@example.com' }
    pageState.activeTenantId = 31

    const { container } = render(<PublicHeader />)
    const header = screen.getByRole('banner')

    expect(within(header).getByRole('link', { name: 'Carteira' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(header).getByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/portal')
    expect(within(header).queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
    expect(within(header).queryByRole('link', { name: 'Para parceiros' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('a[href="/wallet"]')).toHaveLength(1)
    expect(container.querySelectorAll('a[href="/portal"]')).toHaveLength(1)
    expect(within(header).getByRole('button', { name: 'Sair' })).toBeEnabled()
  })

  it('uses the centralized guest destinations in the mobile navigation', () => {
    pageState.url = '/cidades'

    render(<PublicMobileNavigation />)
    const navigation = screen.getByRole('navigation', { name: 'Navegação móvel' })

    expect(within(navigation).getAllByRole('link')).toHaveLength(3)
    expect(within(navigation).getByRole('link', { name: 'Explorar' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(navigation).getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/login'
    )
    expect(within(navigation).getByRole('link', { name: 'Cadastrar negócio' })).toHaveAttribute(
      'href',
      '/register'
    )
  })

  it('uses the authenticated destinations and marks the wallet active on mobile', () => {
    pageState.url = '/wallet/history'
    pageState.user = { id: 7, full_name: 'Ana Souza', email: 'ana@example.com' }
    pageState.activeTenantId = 31

    render(<PublicMobileNavigation />)
    const navigation = screen.getByRole('navigation', { name: 'Navegação móvel' })

    expect(within(navigation).getAllByRole('link')).toHaveLength(3)
    expect(within(navigation).getByRole('link', { name: 'Explorar' })).toHaveAttribute(
      'href',
      '/cidades'
    )
    expect(within(navigation).getByRole('link', { name: 'Carteira' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(navigation).getByRole('link', { name: 'Portal' })).toHaveAttribute(
      'href',
      '/portal'
    )
    expect(within(navigation).queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Sair' })).toBeEnabled()
  })

  it('keeps an authenticated account without an operation on valid public destinations', async () => {
    pageState.url = '/cidades'
    pageState.user = { id: 8, full_name: 'Bruno Lima', email: 'bruno@example.com' }
    const { user } = render(
      <>
        <PublicHeader />
        <PublicMobileNavigation />
      </>
    )
    const header = screen.getByRole('banner')
    const mobile = screen.getByRole('navigation', { name: 'Navegação móvel' })

    expect(within(header).getByRole('link', { name: 'Explorar' })).toHaveAttribute(
      'href',
      '/cidades'
    )
    expect(within(header).queryByRole('link', { name: 'Carteira' })).not.toBeInTheDocument()
    expect(within(header).queryByRole('link', { name: 'Portal' })).not.toBeInTheDocument()
    expect(within(mobile).queryByRole('link', { name: 'Carteira' })).not.toBeInTheDocument()
    expect(within(mobile).queryByRole('link', { name: 'Portal' })).not.toBeInTheDocument()
    expect(within(mobile).getAllByRole('link')).toHaveLength(1)

    await user.click(within(mobile).getByRole('button', { name: 'Sair' }))
    expect(inertia.post).toHaveBeenCalledWith('/logout')
  })

  it('preserves the accessible public shell contract', () => {
    pageState.user = { id: 7, full_name: 'Ana Souza', email: 'ana@example.com' }

    render(
      <PublicShell title="Catálogo" description="Descoberta pública">
        <p>Conteúdo público</p>
      </PublicShell>
    )

    expect(screen.getByRole('link', { name: 'Pular para o conteúdo principal' })).toHaveAttribute(
      'href',
      '#conteudo-principal'
    )
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo-principal')
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('contentinfo')).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Navegação do rodapé' })).toBeVisible()
    expect(screen.getByRole('contentinfo').querySelector('a[href="/login"]')).toBeNull()
    expect(screen.getByRole('contentinfo').querySelector('a[href="/register"]')).toBeNull()
    expect(screen.getByRole('main').parentElement).toHaveAttribute('data-public-shell')
    expect(screen.getByRole('main').parentElement).toHaveClass(
      'pb-[var(--public-mobile-navigation-space)]'
    )
    expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toHaveClass(
      'min-h-[var(--public-mobile-navigation-space)]',
      'pl-[max(0.5rem,env(safe-area-inset-left))]',
      'pr-[max(0.5rem,env(safe-area-inset-right))]'
    )
  })

  it('turns the home into one literal path from city selection to local discovery', () => {
    const { container } = render(<Home />)
    const main = screen.getByRole('main')
    const content = within(main)

    expect(
      content.getByRole('heading', {
        level: 1,
        name: 'Encontre lugares e serviços na sua cidade.',
      })
    ).toBeVisible()
    expect(content.getByRole('link', { name: 'Escolher uma cidade' })).toHaveAttribute(
      'href',
      '/cidades'
    )
    expect(content.getByRole('link', { name: 'Cadastrar negócio' })).toHaveAttribute(
      'href',
      '/register'
    )
    expect(content.getByRole('link', { name: 'Cadastrar negócio' })).toHaveAttribute(
      'data-slot',
      'button'
    )
    expect(main.querySelectorAll('a[href="/cidades"]')).toHaveLength(1)
    expect(main.querySelectorAll('a[href="/register"]')).toHaveLength(1)
    expect(content.getAllByText('Restaurantes')).toHaveLength(1)
    expect(content.getAllByText('Cafés e padarias')).toHaveLength(1)

    const categorySection = content
      .getByRole('heading', { name: 'O que você pode encontrar' })
      .closest('section')
    const categoryItems = within(categorySection!).getAllByRole('listitem')

    expect(categoryItems[1]).toHaveClass('border-t', 'sm:border-t-0', 'sm:border-l')
    expect(categoryItems[2]).toHaveClass('border-t', 'lg:border-t-0', 'lg:border-l')
    expect(categoryItems[2]).not.toHaveClass('sm:border-t-0')
    expect(categoryItems[3]).toHaveClass(
      'border-t',
      'sm:border-l',
      'lg:border-t-0',
      'lg:border-l'
    )
    expect(content.getByText('Como funciona')).toBeVisible()
    expect(content.getByText(/A publicação depende de revisão\./)).toBeVisible()
    expect(container.querySelector('main')?.textContent).not.toMatch(/\b(melhor|exclusiv[oa])\b/i)

    const header = screen.getByRole('banner')
    const footer = screen.getByRole('contentinfo')
    const mobileNavigation = screen.getByRole('navigation', { name: 'Navegação móvel' })
    expect(within(header).queryByRole('link', { name: 'Cadastrar negócio' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('link', { name: 'Cadastrar negócio' })).not.toBeInTheDocument()
    expect(within(footer).queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('link', { name: 'Cadastrar negócio' })).toHaveAttribute(
      'href',
      '/register'
    )
    expect(container.querySelectorAll('a[href="/register"]')).toHaveLength(2)
  })

  it('keeps the owned public surfaces flat and free of unsupported claims', () => {
    const paths = [
      'inertia/pages/home.tsx',
      'inertia/components/public/public_header.tsx',
      'inertia/components/public/public_footer.tsx',
      'inertia/components/public/public_mobile_navigation.tsx',
      'inertia/components/public/public_shell.tsx',
      'inertia/components/app_brand.tsx',
    ]
    const sources = paths.map((path) => readFileSync(path, 'utf8')).join('\n')
    const homeSource = readFileSync('inertia/pages/home.tsx', 'utf8')

    expect(sources).not.toMatch(/bg-gradient|backdrop-blur|blur-3xl|shadow-(?:xl|2xl)/)
    expect(sources).not.toMatch(/\b(?:melhor|exclusiv[oa])\b/i)
    expect(homeSource).not.toMatch(/text-primary-foreground\/(?:70|75)/)
    expect(homeSource.match(/text-primary-foreground\/85/g)).toHaveLength(3)
    expect(homeSource.match(/href="\/cidades"/g)).toHaveLength(1)
    expect(homeSource.match(/href="\/register"/g)).toHaveLength(1)

    const brandSource = readFileSync('inertia/components/app_brand.tsx', 'utf8')
    const appStyles = readFileSync('inertia/css/app.css', 'utf8')
    expect(brandSource).not.toMatch(/bg-gradient|shadow-|rounded-full|\babsolute\b/)
    expect(appStyles).toContain('--public-mobile-navigation-reserve: 4.5rem')
    expect(appStyles).toContain(
      '--public-mobile-focus-clearance: calc(var(--public-mobile-navigation-space) + 1rem)'
    )
    expect(appStyles).toContain('@media (max-width: 47.999rem)')
    expect(appStyles).toContain('html:has([data-public-shell])')
    expect(appStyles).toContain('scroll-padding-bottom: var(--public-mobile-focus-clearance)')
    expect(appStyles).toContain('scroll-margin-bottom: var(--public-mobile-focus-clearance)')
    expect(sources).toContain('pl-[max(0.5rem,env(safe-area-inset-left))]')
    expect(sources).toContain('pr-[max(0.5rem,env(safe-area-inset-right))]')
  })
})
