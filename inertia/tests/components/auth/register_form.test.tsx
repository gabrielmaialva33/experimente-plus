import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RegisterForm } from '~/components/auth/register_form'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  processing: false,
  errors: {} as Record<string, string>,
}))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')
  return {
    Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setData] = React.useState<T>(initial)
      return {
        data,
        setData: (key: keyof T, value: unknown) =>
          setData((previous) => ({ ...previous, [key]: value })),
        post: mocks.post,
        processing: mocks.processing,
        errors: mocks.errors,
      }
    },
  }
})

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.processing = false
    mocks.errors = {}
  })

  it('renders the account fields without a duplicated inner card', () => {
    const { container } = render(<RegisterForm />)

    expect(screen.getByLabelText('Nome completo')).toBeRequired()
    expect(screen.getByLabelText('E-mail')).toBeRequired()
    expect(screen.getByLabelText('Usuário')).not.toBeRequired()
    expect(screen.getByLabelText('Senha')).toBeRequired()
    expect(screen.getByLabelText('Confirmar senha')).toBeRequired()
    const legalAcceptance = screen.getByRole('checkbox', {
      name: 'Li e aceito os documentos obrigatórios',
    })
    expect(legalAcceptance).not.toBeChecked()
    expect(legalAcceptance).toBeRequired()
    expect(legalAcceptance).toHaveAttribute('aria-required', 'true')
    expect(container.querySelector('input[name="terms_accepted"]')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos')
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute(
      'href',
      '/privacidade'
    )
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled()
    expect(screen.getByLabelText('Nome completo')).not.toHaveAttribute('autofocus')
    expect(container.querySelector('[data-slot="card"]')).not.toBeInTheDocument()
  })

  it('shows password guidance and submits the registration form', async () => {
    const { user } = render(<RegisterForm />)

    expect(screen.getByText('Use ao menos 8 caracteres')).toBeInTheDocument()
    expect(screen.getByText('As duas senhas devem coincidir')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome completo'), 'Maria da Silva')
    await user.type(screen.getByLabelText('E-mail'), 'maria@example.com')
    await user.type(screen.getByLabelText('Usuário'), 'maria.silva')
    await user.type(screen.getByLabelText('Senha'), 'password123')
    await user.type(screen.getByLabelText('Confirmar senha'), 'password123')
    await user.click(
      screen.getByRole('checkbox', { name: 'Li e aceito os documentos obrigatórios' })
    )
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(mocks.post).toHaveBeenCalledWith('/register')
  })

  it('reveals and hides both password inputs accessibly', async () => {
    const { user } = render(<RegisterForm />)
    const password = screen.getByLabelText('Senha')
    const actions = screen.getAllByRole('button', { name: 'Mostrar senha' })

    expect(password).toHaveAttribute('type', 'password')
    await user.click(actions[0])
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getAllByRole('button', { name: 'Ocultar senha' })).toHaveLength(1)
  })

  it('announces validation and loading states', () => {
    mocks.processing = true
    mocks.errors = { terms_accepted: 'Você precisa aceitar os documentos.' }

    render(<RegisterForm />)

    expect(screen.getByRole('form', { name: 'Criar conta' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Criando conta...' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Você precisa aceitar os documentos.')
  })
})
