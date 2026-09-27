import { readFileSync } from 'node:fs'

import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { MAIN_CONTENT_ID } from '~/components/skip_link'
import { AuthSplitLayout } from '~/layouts/auth/auth_split_layout'
import PrivacyPage from '~/pages/legal/privacy'
import TermsPage from '~/pages/legal/terms'
import { render } from '~/tests/test_utils'

const pageState = vi.hoisted(() => ({
  user: null as null | { id: number; full_name: string; email: string },
}))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => ({
    url: '/termos',
    props: {
      app: {
        name: 'Experimente+',
        url: 'http://experimente.test',
        sourceUrl: null,
        environment: 'test',
        demoPagesEnabled: false,
      },
      auth: { user: pageState.user, tenants: [], activeTenantId: null, permissions: [] },
    },
  }),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Alterar tema</button>,
}))

describe('authentication and legal experience', () => {
  it('keeps the auth task focused and the skip link first', async () => {
    const { user } = render(
      <AuthSplitLayout
        title="Entrar"
        subtitle="Acesse sua conta."
        contextTitle="Contexto útil"
        contextDescription="Informação secundária."
      >
        <button type="button">Continuar</button>
      </AuthSplitLayout>
    )

    await user.tab()

    expect(screen.getByRole('link', { name: 'Pular para o conteúdo principal' })).toHaveFocus()
    expect(screen.getByRole('main')).toHaveAttribute('id', MAIN_CONTENT_ID)
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
    expect(screen.getByRole('complementary', { name: 'Sobre este acesso' })).toBeVisible()
  })

  it('serves terms with the real privacy and registration destinations', () => {
    render(<TermsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Termos de Uso' })).toBeVisible()
    expect(screen.getByText(/um código que vale por cinco minutos/)).toBeVisible()
    // Purchases exist: the terms no longer say there is no checkout or payment.
    expect(screen.getByRole('heading', { name: '5. Compras e benefícios' })).toBeVisible()
    expect(document.body).not.toHaveTextContent(/não oferece reserva, checkout, pagamento/)
    expect(document.body).not.toHaveTextContent(/Snapshots|Capacidades sobre uma organização/)
    expect(screen.getByRole('link', { name: 'Ler a Política de Privacidade' })).toHaveAttribute(
      'href',
      '/privacidade'
    )
    expect(screen.getByRole('link', { name: 'Voltar ao cadastro' })).toHaveAttribute(
      'href',
      '/register'
    )
  })

  it('does not send a signed-in reader back to the sign-up form', () => {
    pageState.user = { id: 3, full_name: 'Ana Souza', email: 'ana@example.com' }
    try {
      render(<TermsPage />)

      expect(screen.getByRole('link', { name: 'Ler a Política de Privacidade' })).toBeVisible()
      expect(screen.queryByRole('link', { name: 'Voltar ao cadastro' })).not.toBeInTheDocument()
    } finally {
      pageState.user = null
    }
  })

  it('describes the implemented privacy controls without claiming persisted consent', () => {
    render(<PrivacyPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeVisible()
    expect(screen.getByText(/Global Privacy Control ou Do Not Track/)).toBeVisible()
    expect(screen.getByText(/Um canal público de atendimento será definido/)).toBeVisible()
    expect(screen.getByText(/comprovantes de benefícios já usados podem manter/)).toBeVisible()
    expect(screen.getByText(/nome e o e-mail vigentes no momento do uso/)).toBeVisible()
    // It names who receives data to work, including the Concierge's AI provider.
    expect(screen.getByText(/provedor de inteligência artificial/)).toBeVisible()
    // Plain Portuguese: no engineering vocabulary left in the document.
    expect(document.body).not.toHaveTextContent(/Snapshots|pipeline|first-party|user agent/i)
    expect(document.body).not.toHaveTextContent(/consentimento armazenado|aceite registrado/i)
    expect(document.body).not.toHaveTextContent(/históricos? (?:permanecem )?anonimizados/i)
  })

  it('keeps owned auth surfaces free of dominant decoration and autofocus', () => {
    const paths = [
      'inertia/layouts/auth/auth_split_layout.tsx',
      'inertia/components/auth/login_form.tsx',
      'inertia/components/auth/register_form.tsx',
      'inertia/components/auth/forgot_password_form.tsx',
      'inertia/components/auth/reset_password_form.tsx',
      'inertia/pages/auth/login.tsx',
      'inertia/pages/auth/register.tsx',
    ]
    const sources = paths.map((path) => readFileSync(path, 'utf8')).join('\n')

    expect(sources).not.toMatch(/bg-gradient|blur-3xl|backdrop-blur|shadow-(?:xl|2xl)/)
    expect(sources).not.toMatch(/autoFocus/)
    expect(sources).not.toMatch(/sou Partner|role.*partner/i)
    expect(sources).not.toMatch(/\bmemberships?\b|\bPartner\b|resgate offline/i)
  })
})
