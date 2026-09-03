import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ConsumerShell } from '~/components/consumer/consumer_shell'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => {
  return {
    usePage: () => ({ url: '/wallet?from=consumer-test', props: {} }),
    Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  }
})

describe('ConsumerShell', () => {
  it('uses only real consumer destinations and keeps the accessible shell contract', () => {
    const { container } = render(
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
  })
})
