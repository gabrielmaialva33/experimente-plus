import type { ReactNode } from 'react'

import { describe, expect, it, vi } from 'vitest'

import BenefitAccessesPage from '~/pages/backoffice/benefits/accesses'
import { render, screen } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  permissions: ['benefit_accesses.list'] as string[],
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({
    can: (permission: string) => mocks.permissions.includes(permission),
  }),
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  router: {
    post: vi.fn(),
  },
}))

describe('BenefitAccessesPage', () => {
  it('keeps the access history readable without grant or revoke controls', () => {
    const edition = {
      id: 5,
      name: 'Experimente Londrina',
      status: 'published',
      usage_starts_at: '2026-09-01T00:00:00.000-03:00',
      usage_ends_at: '2026-12-31T23:59:59.000-03:00',
      city: { id: 2, name: 'Londrina', state_code: 'PR' },
    }

    render(
      <BenefitAccessesPage
        accesses={[
          {
            id: 9,
            source: 'courtesy',
            status: 'active',
            external_reference: null,
            notes: 'Cortesia do piloto.',
            granted_at: '2026-09-03T12:00:00.000Z',
            revoked_at: null,
            revocation_reason: null,
            holder: { id: 11, email: 'visitante@example.com' },
            edition,
          },
        ]}
        editions={[edition]}
      />
    )

    expect(screen.getByText('visitante@example.com')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Experimente Londrina' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Liberar uma carteira' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conceder acesso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revogar acesso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revisar revogação' })).not.toBeInTheDocument()
  })
})
