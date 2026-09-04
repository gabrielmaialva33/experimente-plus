import type { ReactNode } from 'react'

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import BenefitAccessesPage from '~/pages/backoffice/benefits/accesses'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  router: { post: vi.fn() },
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({
    can: (permission: string) => permission === 'benefit_accesses.revoke',
  }),
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

vi.mock('~/components/confirm_dialog', () => ({
  ConfirmDialog: () => null,
}))

const edition = {
  id: 3,
  name: 'Experimente Londrina',
  status: 'published',
  usage_starts_at: '2026-09-01T00:00:00.000-03:00',
  usage_ends_at: '2026-12-31T23:59:59.000-03:00',
  city: { id: 2, name: 'Londrina', state_code: 'PR' },
}

describe('BenefitAccessesPage', () => {
  it('associates the optional revocation reason label with its textarea', async () => {
    const { user } = render(
      <BenefitAccessesPage
        editions={[edition]}
        accesses={[
          {
            id: 7,
            source: 'courtesy',
            status: 'active',
            external_reference: null,
            notes: null,
            granted_at: '2026-09-03T10:00:00.000-03:00',
            revoked_at: null,
            revocation_reason: null,
            holder: { id: 9, email: 'cliente@example.test' },
            edition,
          },
        ]}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Revogar' }))

    expect(screen.getByLabelText(/Motivo da revogação/)).toHaveAttribute(
      'id',
      'access-7-revocation-reason'
    )
  })
})
