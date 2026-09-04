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
    create_revision: false,
    update: false,
    submit: false,
    archive: false,
  },
  benefit_offers: {
    read: true,
    list: true,
    create: false,
    update: false,
    activate: false,
    pause: false,
    archive: false,
  },
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

  it('keeps pause and archive available when new benefit terms are blocked', () => {
    const actions: OrganizationAllowedActions = {
      ...readOnlyActions,
      benefit_offers: {
        ...readOnlyActions.benefit_offers,
        pause: true,
        archive: true,
      },
    }
    const edition = {
      id: 3,
      name: 'Experimente Londrina',
      status: 'published',
      currency: 'BRL',
      usage_starts_at: '2026-09-01T00:00:00.000-03:00',
      usage_ends_at: '2026-12-31T23:59:59.000-03:00',
      city: { id: 2, name: 'Londrina', state_code: 'PR' },
    }
    const offer = {
      edition_id: edition.id,
      title: 'Café em dobro',
      description: 'Compre um café e receba outro.',
      benefit_type: 'buy_one_get_one' as const,
      discount_percentage: null,
      discount_amount_cents: null,
      terms: null,
      available_weekdays_mask: 127,
      daily_start_time: null,
      daily_end_time: null,
      reservation_required: false,
      on_premise_only: true,
      minimum_party_size: 1,
      max_redemptions_per_access: 1,
      edition,
    }

    render(
      <EstablishmentBenefitsPage
        establishment={{
          id: 8,
          organization_id: 4,
          public_name: 'Café Central',
          city_id: 2,
          published: true,
        }}
        editions={[edition]}
        offers={[
          { ...offer, id: 10, status: 'active' },
          { ...offer, id: 11, title: 'Café pausado', status: 'paused' },
        ]}
        allowed_actions={actions}
      />
    )

    expect(screen.getByText('1 ativa')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Arquivar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Ativar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('maps edit and activate controls to their distinct projected actions', () => {
    const edition = {
      id: 3,
      name: 'Experimente Londrina',
      status: 'published',
      currency: 'BRL',
      usage_starts_at: '2026-09-01T00:00:00.000-03:00',
      usage_ends_at: '2026-12-31T23:59:59.000-03:00',
      city: { id: 2, name: 'Londrina', state_code: 'PR' },
    }
    const offer = {
      id: 10,
      edition_id: edition.id,
      title: 'Café em dobro',
      description: 'Compre um café e receba outro.',
      benefit_type: 'buy_one_get_one' as const,
      discount_percentage: null,
      discount_amount_cents: null,
      terms: null,
      available_weekdays_mask: 127,
      daily_start_time: null,
      daily_end_time: null,
      reservation_required: false,
      on_premise_only: true,
      minimum_party_size: 1,
      max_redemptions_per_access: 1,
      status: 'draft',
      edition,
    }
    const establishment = {
      id: 8,
      organization_id: 4,
      public_name: 'Café Central',
      city_id: 2,
      published: true,
    }
    const updateOnly: OrganizationAllowedActions = {
      ...readOnlyActions,
      benefit_offers: { ...readOnlyActions.benefit_offers, update: true },
    }

    const updateView = render(
      <EstablishmentBenefitsPage
        establishment={establishment}
        editions={[edition]}
        offers={[offer]}
        allowed_actions={updateOnly}
      />
    )
    expect(screen.getByRole('button', { name: 'Editar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Ativar' })).not.toBeInTheDocument()
    updateView.unmount()

    const activateOnly: OrganizationAllowedActions = {
      ...readOnlyActions,
      benefit_offers: { ...readOnlyActions.benefit_offers, activate: true },
    }
    render(
      <EstablishmentBenefitsPage
        establishment={establishment}
        editions={[edition]}
        offers={[offer]}
        allowed_actions={activateOnly}
      />
    )
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('keeps archived-edition offers honest and exposes only accepted escape actions', () => {
    const actions: OrganizationAllowedActions = {
      ...readOnlyActions,
      benefit_offers: {
        ...readOnlyActions.benefit_offers,
        update: true,
        activate: true,
        pause: true,
        archive: true,
      },
    }
    const edition = {
      id: 3,
      name: 'Experimente Londrina',
      status: 'archived',
      currency: 'BRL',
      usage_starts_at: '2026-09-01T00:00:00.000-03:00',
      usage_ends_at: '2026-12-31T23:59:59.000-03:00',
      city: { id: 2, name: 'Londrina', state_code: 'PR' },
    }

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
        offers={[
          {
            id: 10,
            edition_id: edition.id,
            title: 'Café em dobro',
            description: 'Compre um café e receba outro.',
            benefit_type: 'buy_one_get_one',
            discount_percentage: null,
            discount_amount_cents: null,
            terms: null,
            available_weekdays_mask: 127,
            daily_start_time: null,
            daily_end_time: null,
            reservation_required: false,
            on_premise_only: true,
            minimum_party_size: 1,
            max_redemptions_per_access: 1,
            status: 'active',
            edition,
          },
          {
            id: 11,
            edition_id: edition.id,
            title: 'Café pausado',
            description: 'Compre um café e receba outro.',
            benefit_type: 'buy_one_get_one',
            discount_percentage: null,
            discount_amount_cents: null,
            terms: null,
            available_weekdays_mask: 127,
            daily_start_time: null,
            daily_end_time: null,
            reservation_required: false,
            on_premise_only: true,
            minimum_party_size: 1,
            max_redemptions_per_access: 1,
            status: 'paused',
            edition,
          },
        ]}
        allowed_actions={actions}
      />
    )

    expect(screen.getByText('0 ativas')).toBeVisible()
    expect(screen.getAllByText('Indisponível')).toHaveLength(2)
    expect(screen.getByText(/pause a oferta antes de arquivar/i)).toBeVisible()
    expect(screen.getByText(/só pode ser arquivada/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Arquivar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ativar' })).not.toBeInTheDocument()
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
