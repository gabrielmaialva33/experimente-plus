import type { AnchorHTMLAttributes } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { LoginForm } from '~/components/auth/login_form'
import { render } from '~/tests/test_utils'

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }))

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
        post: mockPost,
        processing: false,
        errors: {} as Record<string, string>,
      }
    },
  }
})

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    expect(mockPost).toHaveBeenCalledWith('/login')
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
})
