import type { AnchorHTMLAttributes } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, screen } from '@testing-library/react'
import { LoginForm } from '~/components/auth/login_form'
import { MAIN_CONTENT_ID, SkipLink } from '~/components/skip_link'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({ mockPost: vi.fn(), processing: false }))

// Mock the inertia useForm hook with real local state so the controlled
// inputs actually update when the user types (the previous static mock left
// the inputs empty, which also blocked the required-field form submission).
vi.mock('@inertiajs/react', async () => {
  const React = await import('react')
  return {
    Link: ({
      href,
      children,
      ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setData] = React.useState<T>(initial)
      return {
        data,
        setData: (key: keyof T, value: unknown) => setData((prev) => ({ ...prev, [key]: value })),
        // Inertia's reset: the named fields go back to their initial values.
        reset: (...fields: (keyof T)[]) =>
          setData((prev) =>
            fields.length === 0
              ? initial
              : { ...prev, ...Object.fromEntries(fields.map((field) => [field, initial[field]])) }
          ),
        post: mocks.mockPost,
        processing: mocks.processing,
        errors: {} as Record<string, string>,
      }
    },
  }
})

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.processing = false
  })

  it('renders the login form with all fields', () => {
    render(<LoginForm />)

    expect(screen.getByLabelText('E-mail ou usuário')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Esqueceu a senha/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    )
    // A 44 px target that does not grow the label row it sits in.
    expect(screen.getByRole('link', { name: /Esqueceu a senha/i })).toHaveClass('min-h-11', '-my-3')
  })

  it('keeps the skip link as the first keyboard target', async () => {
    const { user } = render(
      <>
        <SkipLink />
        <main id={MAIN_CONTENT_ID}>
          <LoginForm />
        </main>
      </>
    )

    expect(screen.getByLabelText('E-mail ou usuário')).not.toHaveAttribute('autofocus')

    await user.tab()

    expect(screen.getByRole('link', { name: 'Pular para o conteúdo principal' })).toHaveFocus()
  })

  it('allows entering credentials', async () => {
    const { user } = render(<LoginForm />)

    const emailInput = screen.getByLabelText('E-mail ou usuário')
    const passwordInput = screen.getByLabelText('Senha')

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')

    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('password123')
  })

  it('reveals and hides the password accessibly', async () => {
    const { user } = render(<LoginForm />)
    const password = screen.getByLabelText('Senha')

    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('submits the form when the sign in button is clicked', async () => {
    const { user } = render(<LoginForm />)

    await user.type(screen.getByLabelText('E-mail ou usuário'), 'test@example.com')
    await user.type(screen.getByLabelText('Senha'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(mocks.mockPost).toHaveBeenCalledWith(
      '/login',
      expect.objectContaining({ onError: expect.any(Function) })
    )
  })

  it('clears the password, and only the password, after a failed attempt (W44)', async () => {
    const { user } = render(<LoginForm />)

    await user.type(screen.getByLabelText('E-mail ou usuário'), 'ana@example.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-errada')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    const [, options] = mocks.mockPost.mock.calls[0] as [string, { onError: () => void }]
    act(() => options.onError())

    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(screen.getByLabelText('E-mail ou usuário')).toHaveValue('ana@example.com')
  })

  it('announces the general server error in an accessible alert', () => {
    render(
      <LoginForm errors={{ general: 'Não foi possível entrar. Verifique suas credenciais.' }} />
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível entrar. Verifique suas credenciais.')
  })

  it('does not render an alert when there is no general error', () => {
    render(<LoginForm errors={{ uid: 'campo obrigatório' }} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('exposes the deterministic loading state to assistive technology', () => {
    mocks.processing = true

    render(<LoginForm />)

    expect(screen.getByRole('form', { name: 'Entrar' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Entrando...' })).toBeDisabled()
  })
})
