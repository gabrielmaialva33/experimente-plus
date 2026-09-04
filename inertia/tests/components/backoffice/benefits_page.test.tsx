import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BenefitsBackofficePage from '~/pages/backoffice/benefits'
import { render, screen } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({
    can: (permission: string) => mocks.permissions.includes(permission),
  }),
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

vi.mock('@inertiajs/react', () => {
  return {
    Head: () => null,
    Link: ({ children, href }: { children: ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
    router: {
      delete: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    },
  }
})

const edition = {
  id: 7,
  city_id: 2,
  name: 'Experimente Londrina 2026',
  slug: 'londrina-2026',
  description: 'Edição local.',
  price_cents: 14990,
  currency: 'BRL',
  sales_starts_at: null,
  sales_ends_at: null,
  usage_starts_at: '2026-09-01T00:00:00.000-03:00',
  usage_ends_at: '2026-12-31T23:59:59.000-03:00',
  status: 'draft',
  city: { id: 2, name: 'Londrina', state_code: 'PR' },
  offers: [],
  accesses: [],
}

describe('BenefitsBackofficePage', () => {
  beforeEach(() => {
    mocks.permissions = []
    window.scrollTo = vi.fn()
  })

  it('lets update-only operators select an edition without exposing a dead create form', async () => {
    mocks.permissions = ['benefit_editions.update']

    const { user } = render(<BenefitsBackofficePage editions={[edition]} cities={[edition.city]} />)

    expect(screen.getByRole('heading', { name: 'Selecione uma edição para editar' })).toBeVisible()
    expect(screen.queryByText('Nova edição')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar edição' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nome da edição')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar' }))

    expect(screen.getByRole('heading', { name: 'Ajuste o período e a apresentação' })).toBeVisible()
    expect(screen.getByLabelText('Nome da edição')).toHaveValue(edition.name)
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled()
  })

  it('renders editions read-only for moderators without exposing mutations', () => {
    mocks.permissions = ['benefit_editions.list', 'benefit_accesses.list']

    render(<BenefitsBackofficePage editions={[edition]} cities={[edition.city]} />)

    expect(screen.getByRole('heading', { name: edition.name })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Acessos' })).toHaveAttribute(
      'href',
      '/backoffice/accesses'
    )
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar edição' })).not.toBeInTheDocument()
  })
})
