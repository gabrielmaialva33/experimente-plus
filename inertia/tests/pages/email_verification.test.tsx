import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import EmailVerificationPage, { type EmailVerificationPageProps } from '~/pages/auth/verify_email'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  flash: {} as { success?: string | null; error?: string | null },
  errors: {} as Record<string, string>,
}))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { post: mocks.post },
  usePage: () => ({
    url: '/verificar-email',
    props: {
      app: { name: 'Experimente+', demoPagesEnabled: false },
      flash: mocks.flash,
      errors: mocks.errors,
    },
  }),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => null,
}))

const signedOut = { signed_in: false, email: null, email_verified: null }
const pending = { signed_in: true, email: 'ana@example.com', email_verified: false }
const confirmed = { signed_in: true, email: 'ana@example.com', email_verified: true }

function renderPage(props: EmailVerificationPageProps) {
  return render(<EmailVerificationPage {...props} />)
}

describe('EmailVerificationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.flash = {}
    mocks.errors = {}
  })

  it('confirms and continues to the wallet or to sign-in', () => {
    const { unmount } = renderPage({ outcome: 'confirmed', viewer: confirmed })
    expect(screen.getByRole('heading', { level: 1, name: 'E-mail confirmado' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ir para a carteira' })).toHaveAttribute(
      'href',
      '/wallet'
    )
    unmount()

    renderPage({ outcome: 'confirmed', viewer: signedOut })
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
  })

  it('tells an address that was already confirmed', () => {
    renderPage({ outcome: 'already_confirmed', viewer: signedOut })

    expect(screen.getByRole('heading', { level: 1, name: 'E-mail já confirmado' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Enviar novo link' })).not.toBeInTheDocument()
  })

  it('offers a new link for an expired one to the signed-in account', async () => {
    const { user } = renderPage({ outcome: 'expired', viewer: pending })

    expect(screen.getByRole('heading', { level: 1, name: 'Link expirado' })).toBeVisible()
    expect(screen.getByText('ana@example.com')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Enviar novo link' }))

    expect(mocks.post).toHaveBeenCalledWith(
      '/verificar-email/reenviar',
      {},
      expect.objectContaining({ onFinish: expect.any(Function) })
    )
  })

  it('sends a signed-out visitor with an expired or invalid link through sign-in', () => {
    const { unmount } = renderPage({ outcome: 'expired', viewer: signedOut })
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/login?next=%2Fverificar-email'
    )
    expect(screen.queryByRole('button', { name: 'Enviar novo link' })).not.toBeInTheDocument()
    unmount()

    renderPage({ outcome: 'invalid', viewer: signedOut })
    expect(screen.getByRole('heading', { level: 1, name: 'Link inválido' })).toBeVisible()
    expect(screen.getByText(/Se você já confirmou o e-mail, é só entrar/)).toBeVisible()
  })

  it('shows where the account stands when opened without a link', () => {
    const { unmount } = renderPage({ outcome: null, viewer: pending })
    expect(screen.getByRole('heading', { level: 1, name: 'Confirme seu e-mail' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Enviar novo link' })).toBeVisible()
    unmount()

    const { unmount: unmountConfirmed } = renderPage({ outcome: null, viewer: confirmed })
    expect(screen.getByRole('heading', { level: 1, name: 'E-mail já confirmado' })).toBeVisible()
    unmountConfirmed()

    renderPage({ outcome: null, viewer: signedOut })
    expect(screen.getByText(/Abra o link que enviamos/)).toBeVisible()
  })

  it('shows the result of a resend and a refused attempt', () => {
    mocks.flash = { success: 'Enviamos um novo link para ana@example.com.' }
    mocks.errors = { general: 'Muitas tentativas. Tente mais tarde.' }

    renderPage({ outcome: null, viewer: pending })

    expect(screen.getByRole('status')).toHaveTextContent('Enviamos um novo link')
    expect(screen.getByRole('alert')).toHaveTextContent('Muitas tentativas')
  })
})
