import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import NewEstablishmentPage from '~/pages/portal/establishments/new'
import NewOrganizationPage from '~/pages/portal/organizations/new'
import { render } from '~/tests/test_utils'

const { mockPost, formState } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  formState: {
    current: {
      processing: false,
      errors: {} as Record<string, string>,
    },
  },
}))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')

  return {
    Head: () => null,
    Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setDataState] = React.useState(initial)

      return {
        data,
        setData: (field: keyof T, value: T[keyof T]) =>
          setDataState((current) => ({ ...current, [field]: value })),
        post: mockPost,
        processing: formState.current.processing,
        errors: formState.current.errors,
      }
    },
  }
})

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

describe('new Portal forms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    formState.current = { processing: false, errors: {} }
  })

  it('renders every organization error with appropriate field semantics', () => {
    formState.current.errors = {
      general: 'Revise os dados informados.',
      website: 'Informe uma URL válida.',
    }

    render(<NewOrganizationPage />)

    expect(screen.getByText('Revise os dados informados.')).toBeInTheDocument()
    expect(screen.getByText('Informe uma URL válida.')).toHaveAttribute('role', 'alert')

    const website = screen.getByLabelText(/Website/)
    expect(website).toHaveAttribute('type', 'url')
    expect(website).toHaveAttribute('autocomplete', 'url')
    expect(website).toHaveAttribute('aria-invalid', 'true')

    expect(screen.getByLabelText(/CNPJ/)).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByLabelText(/Telefone/)).toHaveAttribute('type', 'tel')
  })

  it('blocks establishment creation when the tenant has no enabled city', () => {
    render(
      <NewEstablishmentPage
        organization={{ id: 4, trade_name: 'Café Central' }}
        cities={[]}
        categories={[]}
      />
    )

    expect(screen.getByText('Nenhuma cidade está disponível')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar e continuar' })).toBeDisabled()
    expect(screen.getByLabelText(/Cidade/)).toBeDisabled()
  })

  it('preserves backend limits and prevents duplicate establishment submissions', () => {
    render(
      <NewEstablishmentPage
        organization={{ id: 4, trade_name: 'Café Central' }}
        cities={[{ id: 2, name: 'Cornélio Procópio' }]}
        categories={[{ id: 11, name: 'Cafés' }]}
      />
    )

    const name = screen.getByLabelText(/Nome público/)
    const description = screen.getByLabelText(/Descrição curta/)
    fireEvent.change(name, { target: { value: 'Café Central — Centro' } })
    fireEvent.change(description, { target: { value: 'Cafés especiais e brunch no centro.' } })

    expect(description).toHaveAttribute('maxlength', '280')
    expect(screen.getByText('35 de 280 caracteres')).toBeInTheDocument()
    expect(screen.getByLabelText(/Telefone público/)).toHaveAttribute('type', 'tel')

    const submit = screen.getByRole('button', { name: 'Criar e continuar' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith(
      '/portal/organizations/4/establishments',
      expect.objectContaining({ onFinish: expect.any(Function) })
    )
  })
})
