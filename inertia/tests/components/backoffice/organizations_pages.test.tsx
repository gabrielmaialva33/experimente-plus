import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

import OrganizationQueuePage from '~/pages/backoffice/organizations/index'
import OrganizationReviewPage from '~/pages/backoffice/organizations/show'
import { render } from '~/tests/test_utils'

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')
  return {
    Head: () => null,
    Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setData] = React.useState<T>(initial)
      const dataRef = React.useRef(data)
      dataRef.current = data
      const transformRef = React.useRef<(input: T) => unknown>((input) => input)
      return {
        data,
        setData: (key: keyof T, value: unknown) =>
          setData((previous) => ({ ...previous, [key]: value })),
        transform: (callback: (input: T) => unknown) => {
          transformRef.current = callback
        },
        post: (url: string, options?: Record<string, unknown>) =>
          mockPost(url, transformRef.current(dataRef.current), options),
        clearErrors: () => {},
        processing: false,
        errors: {},
      }
    },
  }
})

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const counts = {
  draft: 0,
  pending_review: 1,
  changes_requested: 0,
  active: 4,
  rejected: 0,
  suspended: 0,
  archived: 0,
}

const person = { id: 9, full_name: 'Marina Duarte', email: 'marina@exemplo.com' }

function queueProps(overrides: Partial<ComponentProps<typeof OrganizationQueuePage>> = {}) {
  return {
    status: 'pending_review' as const,
    counts,
    organizations: [
      {
        id: 31,
        trade_name: 'Casa Norte',
        legal_name: 'Casa Norte Alimentos Ltda.',
        tax_id: '11222333000181',
        status: 'pending_review' as const,
        submitted_at: '2026-09-26T14:10:00-03:00',
        submitted_by: person,
        establishments: 2,
      },
    ],
    claims: [],
    claim_decisions: { approve: true, reject: true },
    ...overrides,
  }
}

function reviewProps(
  overrides: Partial<ComponentProps<typeof OrganizationReviewPage>> = {}
): ComponentProps<typeof OrganizationReviewPage> {
  return {
    organization: {
      id: 31,
      legal_name: 'Casa Norte Alimentos Ltda.',
      trade_name: 'Casa Norte',
      slug: 'casa-norte',
      tax_id: '11222333000181',
      email: 'contato@casanorte.example',
      phone: '43999990000',
      website: null,
      status: 'pending_review',
      created_at: '2026-09-25T10:00:00-03:00',
      submitted_at: '2026-09-26T14:10:00-03:00',
      reviewed_at: null,
      review_notes: null,
      reviewed_by: null,
    },
    submitted_by: person,
    created_by: person,
    members: [
      { id: 1, full_name: 'Marina Duarte', email: person.email, role: 'owner', status: 'active' },
    ],
    establishments: [
      {
        id: 5,
        public_name: 'Casa Norte — Centro',
        city_name: 'Londrina',
        revision_status: 'draft',
        published: false,
      },
    ],
    history: [
      {
        id: 3,
        action: 'submit',
        status: 'pending_review',
        reason: null,
        actor: 'Marina Duarte',
        at: '2026-09-26T14:10:00-03:00',
      },
    ],
    decisions: { approve: true, request_changes: true, reject: true },
    ...overrides,
  }
}

describe('back-office organization queue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists who sent each organization, its CNPJ and its places, and opens the analysis', () => {
    render(<OrganizationQueuePage {...queueProps()} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Organizações' })).toBeInTheDocument()
    expect(screen.getByText('1 organização esperando')).toBeInTheDocument()
    expect(screen.getByText(/CNPJ 11\.222\.333\/0001-81/)).toBeInTheDocument()
    expect(screen.getByText(/Enviada por Marina Duarte em/)).toBeInTheDocument()
    expect(screen.getByText('2 lugares')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Analisar/ })).toHaveAttribute(
      'href',
      '/backoffice/organizations/31'
    )
    // Only the states with something in them are offered, besides the queue itself.
    const filters = screen.getByRole('navigation', { name: 'Estado das organizações' })
    expect(
      within(filters)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Em análise1', 'Ativas4'])
    expect(screen.getByText('Nenhuma reivindicação esperando.')).toBeInTheDocument()
  })

  it('explains an empty queue by what fills it', () => {
    render(
      <OrganizationQueuePage
        {...queueProps({ organizations: [], counts: { ...counts, pending_review: 0 } })}
      />
    )

    expect(screen.getByText('Nenhuma organização esperando')).toBeInTheDocument()
    expect(screen.getByText('Nada esperando')).toHaveClass('bg-muted')
  })

  it('decides a claim only with a written reason', async () => {
    const { user } = render(
      <OrganizationQueuePage
        {...queueProps({
          claims: [
            {
              id: 4,
              created_at: '2026-09-26T10:00:00-03:00',
              message: 'Sou o sócio responsável.',
              evidence_description: 'Contrato social.',
              document_count: 1,
              claimant: person,
              organization: {
                id: 40,
                trade_name: 'Bar Sem Dono',
                legal_name: 'Bar Sem Dono Ltda.',
                tax_id: '11222333000181',
                status: 'active',
              },
            },
          ],
        })}
      />
    )

    expect(screen.getByText('1 documento anexado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Recusar' }))
    const dialog = screen.getByRole('alertdialog')
    const confirm = within(dialog).getByRole('button', { name: 'Recusar reivindicação' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Motivo da recusa'), 'Sem comprovação.')
    await user.click(confirm)
    expect(mockPost).toHaveBeenCalledWith(
      '/backoffice/organization-claims/4/reject',
      { reason: 'Sem comprovação.' },
      expect.anything()
    )
  })
})

describe('back-office organization analysis', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the submitted data, the team, the places and the history', () => {
    render(<OrganizationReviewPage {...reviewProps()} />)

    const data = screen.getByRole('region', { name: 'Dados enviados' })
    expect(within(data).getByText('Casa Norte Alimentos Ltda.')).toBeInTheDocument()
    expect(within(data).getByText('11.222.333/0001-81')).toBeInTheDocument()
    expect(within(data).getByText('(43) 99999-0000')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Quem enviou' })).toHaveTextContent('Marina Duarte')
    expect(screen.getByRole('region', { name: 'Lugares cadastrados' })).toHaveTextContent(
      'Casa Norte — Centro'
    )
    expect(screen.getByText('Enviou para análise')).toBeInTheDocument()
  })

  it('asks for corrections with the reason the partner will read', async () => {
    const { user } = render(<OrganizationReviewPage {...reviewProps()} />)

    await user.click(screen.getByRole('button', { name: 'Pedir correções' }))
    const dialog = screen.getByRole('alertdialog')
    const field = within(dialog).getByLabelText('O que o negócio precisa corrigir')
    expect(
      within(dialog).getByText('O negócio lê este texto no Portal. Seja específico.')
    ).toBeInTheDocument()
    await user.type(field, 'Envie o CNPJ da matriz.')
    await user.click(within(dialog).getByRole('button', { name: 'Pedir correções' }))
    expect(mockPost).toHaveBeenCalledWith(
      '/backoffice/organizations/31/request-changes',
      { reason: 'Envie o CNPJ da matriz.' },
      expect.anything()
    )
  })

  it('approves with the note already written, which the moderator may edit', async () => {
    const { user } = render(<OrganizationReviewPage {...reviewProps()} />)

    await user.click(screen.getByRole('button', { name: 'Aprovar organização' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByLabelText('Observação para o histórico')).toHaveValue(
      'Razão social, CNPJ e contatos conferidos.'
    )
    await user.click(within(dialog).getByRole('button', { name: 'Aprovar organização' }))
    expect(mockPost).toHaveBeenCalledWith(
      '/backoffice/organizations/31/approve',
      { reason: 'Razão social, CNPJ e contatos conferidos.' },
      expect.anything()
    )
  })

  it('offers no decision once the organization left the queue, and says why', () => {
    render(
      <OrganizationReviewPage
        {...reviewProps({
          organization: {
            ...reviewProps().organization,
            status: 'changes_requested',
            reviewed_by: 'Equipe Experimente',
            reviewed_at: '2026-09-26T16:00:00-03:00',
            review_notes: 'Envie o CNPJ da matriz.',
          },
          decisions: { approve: false, request_changes: false, reject: false },
        })}
      />
    )

    expect(screen.getByText('Esta organização não está em análise')).toBeInTheDocument()
    expect(screen.getByText(/Motivo registrado: Envie o CNPJ da matriz\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar organização' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Decidir' })).not.toBeInTheDocument()
  })
})
