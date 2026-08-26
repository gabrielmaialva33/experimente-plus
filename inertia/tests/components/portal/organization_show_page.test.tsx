import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PortalOrganizationPage from '~/pages/portal/organizations/show'
import { render } from '~/tests/test_utils'

const { mockPut, mockRouterPost, guardState, formState } = vi.hoisted(() => ({
  mockPut: vi.fn(),
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
    router: { post: mockRouterPost },
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setDataState] = React.useState(initial)

      return {
        data,
        setData: (field: keyof T, value: T[keyof T]) =>
          setDataState((current) => ({ ...current, [field]: value })),
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

describe('PortalOrganizationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    formState.current = { isDirty: false, processing: false, errors: {} }
  })

  it('shows field errors, translated metadata and semantic completeness', () => {
    formState.current = {
      isDirty: true,
      processing: false,
      errors: { website: 'Informe uma URL válida.' },
    }

    render(
      <PortalOrganizationPage organization={organization} feedback_targets={feedbackTargets} />
    )

    expect(screen.getByText('Informe uma URL válida.')).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText(/Website/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Existem alterações não salvas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar para análise' })).toBeDisabled()
    expect(screen.getByText(/Propriet/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '72')
  })

  it('prevents duplicate save requests synchronously', () => {
    formState.current.isDirty = true

    render(
      <PortalOrganizationPage organization={organization} feedback_targets={feedbackTargets} />
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
      <PortalOrganizationPage organization={organization} feedback_targets={feedbackTargets} />
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
})
