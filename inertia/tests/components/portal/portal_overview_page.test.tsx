import type { ComponentProps, ReactNode } from 'react'

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PartnerPortalIndex from '~/pages/portal/index'
import { render } from '~/tests/test_utils'
import type { OrganizationAllowedActions } from '~/types'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({ can: () => false }),
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

vi.mock('~/components/portal/pilot_feedback_form', () => ({
  default: () => null,
}))

const baseActions: OrganizationAllowedActions = {
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
  pilot_feedback: { create: false },
}

function overviewFor(actions: OrganizationAllowedActions, role: string, status = 'active') {
  const organizationId = 4
  const newEstablishmentHref = `/portal/organizations/${organizationId}/establishments/new`

  return {
    organizations: [
      {
        id: organizationId,
        legal_name: 'Rede Aurora Ltda.',
        trade_name: 'Rede Aurora',
        status,
        role,
        allowed_actions: actions,
        establishments: [],
        totals: { establishments: 0, published: 0, pending_review: 0, complete: 0 },
        onboarding: [
          {
            key: 'organization_created',
            label: 'Organização criada',
            completed: true,
            href: `/portal/organizations/${organizationId}`,
            available: actions.organizations.read,
          },
          {
            key: 'establishment_created',
            label: 'Primeira unidade criada',
            completed: false,
            href: newEstablishmentHref,
            available: actions.establishments.create,
          },
          {
            key: 'analytics_available',
            label: 'Métricas de descoberta disponíveis',
            completed: false,
            href: `/organizations/${organizationId}/analytics`,
            available: actions.analytics.read,
          },
        ],
      },
    ],
    totals: { organizations: 1, establishments: 0, published: 0, pending_review: 0, complete: 0 },
  }
}

describe('Partner Portal overview resource actions', () => {
  it('describes complete profiles without implying that published units need resubmission', () => {
    const overview = overviewFor(baseActions, 'owner')
    overview.totals.establishments = 3
    overview.totals.published = 3
    overview.totals.complete = 3

    render(
      <PartnerPortalIndex
        overview={overview}
        allowed_actions={baseActions}
        feedback_targets={{ organizations: [], establishments: [] }}
      />
    )

    expect(screen.getByText('3 fichas completas')).toBeVisible()
    expect(screen.queryByText(/prontas para enviar/i)).not.toBeInTheDocument()
  })

  it('does not link analysts to establishment creation', () => {
    const { container } = render(
      <PartnerPortalIndex
        overview={overviewFor(baseActions, 'analyst')}
        allowed_actions={baseActions}
        feedback_targets={{ organizations: [], establishments: [] }}
      />
    )

    expect(
      container.querySelector('a[href="/portal/organizations/4/establishments/new"]')
    ).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Métricas de descoberta disponíveis' })
    ).toHaveAttribute('href', '/organizations/4/analytics')
    expect(screen.getByRole('link', { name: 'Utilizações' })).toHaveAttribute(
      'href',
      '/portal/redemptions'
    )
    expect(screen.queryByRole('link', { name: 'Validar benefício' })).not.toBeInTheDocument()
  })

  it('links editors to creation while hiding analytics when the projection denies it', () => {
    const editorActions: OrganizationAllowedActions = {
      ...baseActions,
      establishments: { ...baseActions.establishments, create: true, update: true, submit: true },
      redemptions: { read: true, validate: true },
      analytics: { read: false },
    }
    const { container } = render(
      <PartnerPortalIndex
        overview={overviewFor(editorActions, 'editor')}
        allowed_actions={editorActions}
        feedback_targets={{ organizations: [], establishments: [] }}
      />
    )

    expect(
      container.querySelector('a[href="/portal/organizations/4/establishments/new"]')
    ).not.toBeNull()
    expect(container.querySelector('a[href="/organizations/4/analytics"]')).toBeNull()
    expect(screen.getByRole('link', { name: 'Utilizações' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Validar benefício' })).toHaveAttribute(
      'href',
      '/portal/redemptions/validate'
    )
  })

  it('shows no organization-scoped header action without an active membership', () => {
    const noMembershipActions: OrganizationAllowedActions = {
      ...baseActions,
      organizations: { read: false, update: false, submit: false },
      establishments: {
        read: false,
        list: false,
        create: false,
        create_revision: false,
        update: false,
        submit: false,
        archive: false,
      },
      benefit_offers: {
        read: false,
        list: false,
        create: false,
        update: false,
        activate: false,
        pause: false,
        archive: false,
      },
      redemptions: { read: false, validate: false },
      analytics: { read: false },
      pilot_feedback: { create: false },
    }

    render(
      <PartnerPortalIndex
        overview={{
          organizations: [],
          totals: {
            organizations: 0,
            establishments: 0,
            published: 0,
            pending_review: 0,
            complete: 0,
          },
        }}
        allowed_actions={noMembershipActions}
        feedback_targets={{ organizations: [], establishments: [] }}
      />
    )

    expect(screen.queryByRole('link', { name: 'Utilizações' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Validar benefício' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nenhuma organização disponível' })).toBeVisible()
    expect(screen.getByText(/Não há organizações disponíveis para o seu acesso/)).toBeVisible()
  })

  it('keeps new-unit links absent when organization state narrows creation', () => {
    const stateAwareActions: OrganizationAllowedActions = {
      ...baseActions,
      establishments: { ...baseActions.establishments, create: false },
    }
    const { container } = render(
      <PartnerPortalIndex
        overview={overviewFor(stateAwareActions, 'owner', 'pending_review')}
        allowed_actions={stateAwareActions}
        feedback_targets={{ organizations: [], establishments: [] }}
      />
    )

    expect(
      container.querySelector('a[href="/portal/organizations/4/establishments/new"]')
    ).toBeNull()
  })
})
