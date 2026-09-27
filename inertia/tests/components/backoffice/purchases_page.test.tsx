import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

import PurchasesPage from '~/pages/backoffice/purchases/index'
import { render } from '~/tests/test_utils'

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { post: mockPost },
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const pending = {
  id: '0f3c2a1e-8b7d-4c5e-9a10-1234567890ab',
  code: '0F3C2A1E',
  created_at: '2026-09-27T10:00:00-03:00',
  product_name: 'Experimente Londrina — Compra local',
  product_type: 'edition' as const,
  amount_cents: 4990,
  currency: 'BRL',
  method: 'pix' as const,
  status: 'pending' as const,
  paid_at: null,
  expires_at: '2026-09-27T10:15:00-03:00',
  buyer: { full_name: 'Cliente Demonstração', email: 'cliente@exemplo.com' },
  has_access: false,
  simulated: true,
  can_confirm_simulation: true,
}

function props(
  overrides: Partial<ComponentProps<typeof PurchasesPage>> = {}
): ComponentProps<typeof PurchasesPage> {
  return {
    purchases: [pending],
    meta: { total: 1, current_page: 1, last_page: 1, per_page: 20 },
    counts: { pending: 1, paid: 0, review: 0, failed: 0, cancelled: 0, refunded: 0 },
    filters: { status: null, page: 1 },
    simulation: { available: true },
    ...overrides,
  }
}

describe('back-office orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks the test environment and confirms a simulated payment after a confirmation', async () => {
    const { user } = render(<PurchasesPage {...props()} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeInTheDocument()
    expect(screen.getByText('Pagamento simulado — ambiente de testes')).toBeInTheDocument()
    const order = screen.getByRole('article', { name: pending.product_name })
    expect(within(order).getByText('R$ 49,90')).toBeInTheDocument()
    expect(within(order).getByText('Pendente')).toBeInTheDocument()
    expect(within(order).getByText(/Cliente Demonstração/)).toBeInTheDocument()
    expect(within(order).getByText('Pagamento simulado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirmar pagamento simulado' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Nada é cobrado.')
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento simulado' }))
    expect(mockPost).toHaveBeenCalledWith(
      `/backoffice/purchases/${pending.id}/simulate-payment`,
      {},
      expect.anything()
    )
  })

  it('renders no simulation control where the server does not offer it', () => {
    render(
      <PurchasesPage
        {...props({
          simulation: { available: false },
          purchases: [{ ...pending, simulated: false, can_confirm_simulation: false }],
        })}
      />
    )

    expect(screen.queryByText(/Pagamento simulado/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Confirmar pagamento simulado' })
    ).not.toBeInTheDocument()
  })

  it('filters by situation', () => {
    render(<PurchasesPage {...props({ filters: { status: 'paid', page: 1 }, purchases: [] })} />)

    const filters = screen.getByRole('navigation', { name: 'Situação dos pedidos' })
    expect(within(filters).getByRole('link', { name: /Pagos/ })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(filters).getByRole('link', { name: /Pendentes/ })).toHaveAttribute(
      'href',
      '/backoffice/purchases?status=pending'
    )
    expect(screen.getByText('Nenhum pedido está nesta situação.')).toBeInTheDocument()
  })
})
