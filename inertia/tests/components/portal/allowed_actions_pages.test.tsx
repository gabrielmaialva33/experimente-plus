import { readFileSync } from 'node:fs'
import type { ComponentProps, ReactNode } from 'react'

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import EstablishmentBenefitsPage from '~/pages/portal/establishments/benefits'
import PartnerRedemptionsPage from '~/pages/portal/redemptions/index'
import PartnerValidationPage from '~/pages/portal/redemptions/validate'
import { render } from '~/tests/test_utils'
import type { OrganizationAllowedActions } from '~/types'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const readOnlyActions: OrganizationAllowedActions = {
  organizations: { read: true, update: false, submit: false },
  establishments: {
    read: true,
    list: true,
    create: false,
    update: false,
    submit: false,
    archive: false,
  },
  benefit_offers: { read: true, list: true, create: false, update: false, archive: false },
  redemptions: { read: true, validate: false },
  analytics: { read: true },
  pilot_feedback: { create: true },
}

describe('Portal server-projected allowed actions', () => {
  it('hides redemption validation for read-only organization access', () => {
    render(
      <PartnerRedemptionsPage
        history={{ redemptions: [], total: 0 }}
        allowed_actions={readOnlyActions}
      />
    )

    expect(screen.queryByRole('link', { name: 'Validar benefício' })).not.toBeInTheDocument()
  })

  it('shows redemption validation when the scoped backend action allows it', () => {
    const actions: OrganizationAllowedActions = {
      ...readOnlyActions,
      redemptions: { read: true, validate: true },
    }

    render(
      <PartnerRedemptionsPage history={{ redemptions: [], total: 0 }} allowed_actions={actions} />
    )

    expect(screen.getByRole('link', { name: 'Validar benefício' })).toHaveAttribute(
      'href',
      '/portal/redemptions/validate'
    )
  })

  it('keeps benefit management absent while preserving read-only redemption history', () => {
    render(
      <EstablishmentBenefitsPage
        establishment={{
          id: 8,
          organization_id: 4,
          public_name: 'Café Central',
          city_id: 2,
          published: true,
        }}
        editions={[]}
        offers={[]}
        allowed_actions={readOnlyActions}
      />
    )

    expect(screen.queryByText('Nova oferta')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Validar benefício' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Utilizações' })).toHaveAttribute(
      'href',
      '/portal/redemptions'
    )
  })

  it('replaces the validation form with an honest read-only state', () => {
    render(<PartnerValidationPage token="" preview={null} allowed_actions={readOnlyActions} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Validação indisponível' })).toBeVisible()
    expect(screen.queryByLabelText('Link da apresentação')).not.toBeInTheDocument()
  })

  it('wires the establishment editor directly to scoped actions instead of global capabilities', () => {
    const source = readFileSync('inertia/pages/portal/establishments/edit.tsx', 'utf8')

    expect(source).toContain('allowedActions.establishments.update')
    expect(source).toContain('allowedActions.establishments.submit')
    expect(source).toContain('allowedActions.benefit_offers.list')
    expect(source).not.toContain("can('establishments.update')")
  })
})
