import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConsumerShell } from '~/components/consumer/consumer_shell'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({ post: vi.fn(), activeTenantId: 7 as number | null }))

vi.mock('@inertiajs/react', () => {
  return {
    usePage: () => ({
      url: '/wallet?from=consumer-test',
      props: {
        auth: {
          user: { id: 1, full_name: 'Ana Souza', email: 'ana@example.com' },
          tenants: [],
          activeTenantId: mocks.activeTenantId,
          permissions: [],
        },
      },
    }),
    router: { post: mocks.post },
    Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  }
})

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Alterar tema</button>,
}))

describe('ConsumerShell', () => {
  beforeEach(() => {
    mocks.post.mockReset()
    mocks.activeTenantId = 7
  })

  it('uses only real consumer destinations and keeps the accessible shell contract', async () => {
    const { container, user } = render(
      <ConsumerShell>
        <p>Conteúdo da carteira</p>
      </ConsumerShell>
    )

    expect(screen.getAllByRole('link', { name: 'Explorar' })[0]).toHaveAttribute('href', '/cidades')
    expect(screen.getAllByRole('link', { name: 'Carteira' })[0]).toHaveAttribute('href', '/wallet')
    expect(screen.queryByRole('link', { name: 'Perfil' })).not.toBeInTheDocument()
    expect(container.querySelector('a[href="/"]')).not.toBeInTheDocument()
    expect(container.querySelector('a[href="/carteira"]')).not.toBeInTheDocument()
    expect(container.querySelector('a[href="/dashboard"]')).not.toBeInTheDocument()
    expect(container.querySelector('a[href="/settings"]')).not.toBeInTheDocument()
    expect(container.querySelectorAll('a[aria-current="page"]')).toHaveLength(2)
    container.querySelectorAll('a[aria-current="page"]').forEach((activeLink) => {
      expect(activeLink).toHaveAttribute('href', '/wallet')
    })
    expect(container.querySelector('main#conteudo-principal')).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo principal' })).toHaveAttribute(
      'href',
      '#conteudo-principal'
    )
    expect(screen.getByRole('button', { name: 'Alterar tema' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(mocks.post).toHaveBeenCalledWith('/logout')
    expect(container.innerHTML).not.toMatch(/backdrop-blur|shadow-(?:xl|2xl)/)
  })

  it('does not expose tenant-required destinations without an active operation', () => {
    mocks.activeTenantId = null
    const { container } = render(
      <ConsumerShell>
        <p>Destino público seguro</p>
      </ConsumerShell>
    )

    expect(screen.getAllByRole('link', { name: 'Explorar' })).toHaveLength(2)
    expect(screen.queryByRole('link', { name: 'Carteira' })).not.toBeInTheDocument()
    expect(container.querySelector('a[href="/wallet"]')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled()
  })
})
