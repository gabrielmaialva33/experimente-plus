import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import ResetPasswordPage from '~/pages/auth/reset_password'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => ({
    props: {
      app: {
        name: 'Experimente+',
        url: 'http://experimente.test',
        sourceUrl: null,
        environment: 'test',
        demoPagesEnabled: false,
      },
    },
  }),
}))

vi.mock('~/components/auth', () => ({
  ResetPasswordForm: () => <div data-testid="reset-form" />,
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Alterar tema</button>,
}))

describe('ResetPasswordPage', () => {
  it('describes revocation limits without promising immediate access-token invalidation', () => {
    render(<ResetPasswordPage token="opaque-token" />)

    expect(screen.getByText(/sessões que poderiam ser renovadas são encerradas/i)).toBeVisible()
    expect(
      screen.getByText(/acessos já emitidos ainda podem funcionar.*até expirarem/i)
    ).toBeVisible()
    expect(document.body).not.toHaveTextContent(/credenciais ativas anteriores são revogadas/i)
  })
})
