import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RegisterForm } from '~/components/auth/register_form'
import { render } from '~/tests/test_utils'

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')
  return {
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setData] = React.useState<T>(initial)
      return {
        data,
        setData: (key: keyof T, value: unknown) =>
          setData((previous) => ({ ...previous, [key]: value })),
        post: mockPost,
        processing: false,
        errors: {} as Record<string, string>,
      }
    },
  }
})

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the account fields without a duplicated inner card', () => {
    const { container } = render(<RegisterForm />)

    expect(screen.getByLabelText('Nome completo')).toBeRequired()
    expect(screen.getByLabelText('E-mail')).toBeRequired()
    expect(screen.getByLabelText('Usuário')).not.toBeRequired()
    expect(screen.getByLabelText('Senha')).toBeRequired()
    expect(screen.getByLabelText('Confirmar senha')).toBeRequired()
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
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(mockPost).toHaveBeenCalledWith('/register')
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
})
