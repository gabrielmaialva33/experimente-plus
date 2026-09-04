import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PortalOrganizationPage from '~/pages/portal/organizations/show'
import { render } from '~/tests/test_utils'

const { mockPut, mockTransform, mockRouterPost, guardState, formState, authState } = vi.hoisted(
  () => ({
    mockPut: vi.fn(),
    mockTransform: vi.fn(),
    mockRouterPost: vi.fn(),
    guardState: {
      allowNextVisit: vi.fn(),
      confirmDiscard: vi.fn(() => true),
    },
    formState: {
      current: {
        isDirty: false,
        processing: false,
        errors: {} as Record<string, string>,
      },
    },
    authState: {
      permissions: [
        'organizations.update',
        'organizations.submit',
        'establishments.create',
        'analytics.read',
        'pilot_feedback.create',
      ],
    },
  })
)

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')

  return {
    Head: () => null,
    Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
    router: { post: mockRouterPost },
    usePage: () => ({
      props: {
        auth: {
          activeTenantId: 1,
          permissions: authState.permissions,
          tenants: [],
        },
      },
    }),
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setDataState] = React.useState(initial)

      return {
        data,
        setData: (field: keyof T, value: T[keyof T]) =>
          setDataState((current) => ({ ...current, [field]: value })),
        transform: mockTransform,
        put: mockPut,
        processing: formState.current.processing,
        errors: formState.current.errors,
        isDirty: formState.current.isDirty,
        reset: vi.fn(),
        clearErrors: vi.fn(),
        setDefaults: vi.fn(),
      }
    },
  }
})

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

vi.mock('~/hooks/use_unsaved_changes_guard', () => ({
  useUnsavedChangesGuard: () => guardState,
}))

vi.mock('~/components/portal/pilot_feedback_form', () => ({
  default: () => <div data-testid="pilot-feedback-form" />,
}))

vi.mock('~/components/confirm_dialog', () => ({
  ConfirmDialog: ({
    open,
    confirmLabel,
    onConfirm,
  }: {
    open?: boolean
    confirmLabel: string
    onConfirm: () => void
  }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Confirmar: {confirmLabel}
      </button>
    ) : null,
}))

const organization = {
  id: 4,
  legal_name: 'Café Central Ltda.',
  trade_name: 'Café Central',
  slug: 'cafe-central',
  tax_id: '12.345.678/0001-90',
  email: 'contato@cafecentral.test',
  phone: '(43) 3333-4444',
  website: 'https://cafecentral.test',
  status: 'draft',
  role: 'owner',
  totals: { establishments: 1, published: 0, pending_review: 0, complete: 0 },
  establishments: [
    {
      id: 8,
      public_name: 'Café Central — Centro',
      lifecycle_status: 'active',
      business_status: 'active',
      revision: { status: 'draft' },
      published_revision: null,
      completeness: { score: 72, eligible: false, blocking_issues: [] },
    },
  ],
}

const feedbackTargets = {
  organizations: [{ id: 4, label: 'Café Central' }],
  establishments: [{ id: 8, label: 'Café Central — Centro', organization_id: 4 }],
}

const allowedActions = {
  organizations: { read: true, update: true, submit: true },
  establishments: {
    read: true,
    list: true,
    create: true,
    create_revision: false,
    update: true,
    submit: true,
    archive: true,
  },
  benefit_offers: {
    read: true,
    list: true,
    create: true,
    update: true,
    activate: true,
    pause: true,
    archive: true,
  },
  redemptions: { read: true, validate: true },
  analytics: { read: true },
  pilot_feedback: { create: true },
}

describe('PortalOrganizationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    formState.current = { isDirty: false, processing: false, errors: {} }
    authState.permissions = [
      'organizations.update',
      'organizations.submit',
      'establishments.create',
      'analytics.read',
      'pilot_feedback.create',
    ]
  })

  it('shows field errors, translated metadata and semantic completeness', () => {
    formState.current = {
      isDirty: true,
      processing: false,
      errors: { website: 'Informe uma URL válida.' },
    }

    render(
      <PortalOrganizationPage
        organization={organization}
        feedback_targets={feedbackTargets}
        allowed_actions={allowedActions}
      />
    )

    expect(screen.getByText('Informe uma URL válida.')).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText(/Website/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Existem alterações não salvas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar para análise' })).toBeDisabled()
    expect(screen.getByText(/Propriet/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '72')
    expect(screen.getByRole('link', { name: 'Ver analytics' })).toHaveAttribute(
      'href',
      '/organizations/4/analytics'
    )
  })

  it('prevents duplicate save requests synchronously', () => {
    formState.current.isDirty = true

    render(
      <PortalOrganizationPage
        organization={organization}
        feedback_targets={feedbackTargets}
        allowed_actions={allowedActions}
      />
    )

    const save = screen.getByRole('button', { name: 'Salvar dados' })
    fireEvent.click(save)
    fireEvent.click(save)

    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledWith(
      '/portal/organizations/4',
      expect.objectContaining({ preserveScroll: true })
    )
    expect(guardState.allowNextVisit).toHaveBeenCalledTimes(1)
  })

  it('confirms submission and prevents duplicate workflow transitions', () => {
    render(
      <PortalOrganizationPage
        organization={organization}
        feedback_targets={feedbackTargets}
        allowed_actions={allowedActions}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Enviar para análise' }))
    const confirm = screen.getByRole('button', { name: 'Confirmar: Enviar para análise' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(mockRouterPost).toHaveBeenCalledTimes(1)
    expect(mockRouterPost).toHaveBeenCalledWith(
      '/portal/organizations/4/submit',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('keeps a read-only organization view honest about unavailable actions', () => {
    const readOnlyActions = {
      ...allowedActions,
      organizations: { ...allowedActions.organizations, update: false, submit: false },
      establishments: { ...allowedActions.establishments, create: false },
      analytics: { read: false },
      pilot_feedback: { create: false },
    }

    render(
      <PortalOrganizationPage
        organization={organization}
        feedback_targets={feedbackTargets}
        allowed_actions={readOnlyActions}
      />
    )

    expect(screen.getByLabelText(/Razão social/)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Enviar para análise' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Nova unidade' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver analytics' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('pilot-feedback-form')).not.toBeInTheDocument()
  })

  it('prioritizes an open workflow while keeping the current publication visible as context', () => {
    render(
      <PortalOrganizationPage
        organization={{
          ...organization,
          establishments: [
            {
              ...organization.establishments[0],
              revision: { status: 'pending_review' },
              published_revision: { id: 20, status: 'approved' },
            },
          ],
        }}
        feedback_targets={feedbackTargets}
        allowed_actions={allowedActions}
      />
    )

    expect(screen.getByText('Em análise')).toBeVisible()
    expect(screen.getByText('Publicação vigente no catálogo')).toBeVisible()
    expect(screen.queryByText('Publicada')).not.toBeInTheDocument()
  })

  it('edits only commercial contacts after approval and never resubmits an active organization', () => {
    formState.current.isDirty = true

    render(
      <PortalOrganizationPage
        organization={{ ...organization, status: 'active' }}
        feedback_targets={feedbackTargets}
        allowed_actions={allowedActions}
      />
    )

    expect(screen.getByLabelText(/Razão social/)).toBeDisabled()
    expect(screen.getByLabelText(/CNPJ/)).toBeDisabled()
    expect(screen.getByLabelText(/Endereço da página/)).toBeDisabled()
    expect(screen.getByLabelText(/Nome fantasia/)).toBeEnabled()
    expect(screen.getByLabelText(/E-mail/)).toBeEnabled()
    expect(screen.getByLabelText(/Telefone/)).toBeEnabled()
    expect(screen.getByLabelText(/Website/)).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Enviar para análise' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar dados' }))

    const transform = mockTransform.mock.calls[0]?.[0] as (
      data: OrganizationFormDataFixture
    ) => Record<string, string>
    expect(transform(organization)).toEqual({
      trade_name: organization.trade_name,
      email: organization.email,
      phone: organization.phone,
      website: organization.website,
    })
  })
})

type OrganizationFormDataFixture = Pick<
  typeof organization,
  'legal_name' | 'trade_name' | 'slug' | 'tax_id' | 'email' | 'phone' | 'website'
>
