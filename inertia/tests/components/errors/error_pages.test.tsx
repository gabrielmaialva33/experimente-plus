import { screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import NotFound from '~/pages/errors/not_found'
import ServerError, { type PublicServerError } from '~/pages/errors/server_error'
import { render } from '~/tests/test_utils'

const shell = vi.hoisted(() => ({ props: vi.fn() }))

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('~/components/public', () => ({
  PublicErrorShell: ({
    title,
    description,
    children,
  }: {
    title: string
    description: string
    children: ReactNode
  }) => {
    shell.props({ title, description })
    return <main>{children}</main>
  },
}))

beforeEach(() => {
  shell.props.mockClear()
})

describe('error pages', () => {
  it('gives visitors a localized and accessible path out of a 404', () => {
    render(<NotFound />)

    expect(shell.props).toHaveBeenCalledWith({
      title: 'Página não encontrada',
      description: expect.any(String),
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
    expect(screen.getByText('Erro 404')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Explorar cidades' })).toHaveAttribute(
      'href',
      '/cidades'
    )
    expect(document.body).not.toHaveTextContent('Page not found')
    expect(document.body).not.toHaveTextContent('This page does not exist')
  })

  it('renders only the safe server-error projection and recovery actions', () => {
    const error = {
      code: 'E_INTERNAL_SERVER_ERROR',
      message: 'Algo deu errado ao processar sua solicitação. Tente novamente em instantes.',
      status: 503,
      query: 'select secret from private_table',
      stack: 'DatabaseError at /srv/app/database.js',
    } as PublicServerError & { query: string; stack: string }

    render(<ServerError error={error} />)

    expect(shell.props).toHaveBeenCalledWith({
      title: 'Algo deu errado',
      description: expect.any(String),
    })
    expect(
      screen.getByRole('heading', { level: 1, name: 'Não foi possível concluir' })
    ).toBeVisible()
    expect(screen.getByText('Erro 503')).toBeVisible()
    expect(screen.getByText(error.message)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
    expect(document.body).not.toHaveTextContent(error.query)
    expect(document.body).not.toHaveTextContent(error.stack)
    expect(document.body).not.toHaveTextContent('Server Error')
  })
})
