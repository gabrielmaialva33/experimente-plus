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
    update: false,
    submit: false,
    archive: false,
  },
  benefit_offers: { read: true, list: true, create: false, update: false, archive: false },
  redemptions: { read: true, validate: false },
  analytics: { read: true },
  pilot_feedback: { create: false },
}

function overviewFor(actions: OrganizationAllowedActions, role: string) {
  const organizationId = 4
  const newEstablishmentHref = `/portal/organizations/${organizationId}/establishments/new`

  return {
    organizations: [
      {
        id: organizationId,
        legal_name: 'Rede Aurora Ltda.',
        trade_name: 'Rede Aurora',
        status: 'active',
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
  it('does not link analysts to establishment creation', () => {
    const { container } = render(
      <PartnerPortalIndex
        overview={overviewFor(baseActions, 'analyst')}
        feedback_targets={{ organizations: [], establishments: [] }}
      />
    )

    expect(
      container.querySelector('a[href="/portal/organizations/4/establishments/new"]')
    ).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Métricas de descoberta disponíveis' })
    ).toHaveAttribute('href', '/organizations/4/analytics')
  })

  it('links editors to creation while hiding analytics when the projection denies it', () => {
    const editorActions: OrganizationAllowedActions = {
      ...baseActions,
      establishments: { ...baseActions.establishments, create: true, update: true, submit: true },
      analytics: { read: false },
    }
    const { container } = render(
      <PartnerPortalIndex
        overview={overviewFor(editorActions, 'editor')}
        feedback_targets={{ organizations: [], establishments: [] }}
      />
    )

    expect(
      container.querySelector('a[href="/portal/organizations/4/establishments/new"]')
    ).not.toBeNull()
    expect(container.querySelector('a[href="/organizations/4/analytics"]')).toBeNull()
  })
})
