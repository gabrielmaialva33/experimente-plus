import { screen, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OrganizationTeamPage, {
  type OrganizationTeamPageProps,
} from '~/pages/portal/organizations/team'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  formPost: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@inertiajs/react', async () => {
  const React = await import('react')
  return {
    Head: () => null,
    Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
    // Each visit finishes at once, as a completed Inertia request would.
    router: {
      patch: (url: string, data: unknown, options: { onFinish?: () => void }) => {
        mocks.patch(url, data, options)
        options.onFinish?.()
      },
      post: (url: string, data: unknown, options: { onFinish?: () => void }) => {
        mocks.post(url, data, options)
        options.onFinish?.()
      },
      delete: (url: string, options: { onFinish?: () => void }) => {
        mocks.delete(url, options)
        options.onFinish?.()
      },
    },
    useForm: <T extends Record<string, unknown>>(initial: T) => {
      const [data, setData] = React.useState<T>(initial)
      return {
        data,
        setData: (key: keyof T, value: unknown) =>
          setData((previous) => ({ ...previous, [key]: value })),
        post: (url: string, options: unknown) => mocks.formPost(url, data, options),
        processing: false,
        errors: {} as Record<string, string>,
        reset: vi.fn(),
        clearErrors: vi.fn(),
      }
    },
  }
})

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const noActions = { roles: [], suspend: false, reactivate: false, remove: false }

function ownerView(): OrganizationTeamPageProps {
  return {
    organization: {
      id: 4,
      trade_name: 'Casa Paineira',
      status: 'active',
      accepts_invitations: true,
    },
    viewer: { source: 'membership', role: 'owner' },
    members: [
      {
        id: 1,
        user: { id: 10, full_name: 'Helena Proprietária', email: 'helena@example.com' },
        role: 'owner',
        status: 'active',
        joined_at: '2026-09-01T12:00:00.000Z',
        suspended_at: null,
        is_self: true,
        is_last_owner: true,
        actions: noActions,
      },
      {
        id: 2,
        user: { id: 20, full_name: 'Edu Editor', email: 'edu@example.com' },
        role: 'editor',
        status: 'active',
        joined_at: '2026-09-02T12:00:00.000Z',
        suspended_at: null,
        is_self: false,
        is_last_owner: false,
        actions: {
          roles: ['owner', 'admin', 'analyst'],
          suspend: true,
          reactivate: false,
          remove: true,
        },
      },
      {
        id: 3,
        user: { id: 30, full_name: 'Ana Analista', email: 'ana@example.com' },
        role: 'analyst',
        status: 'suspended',
        joined_at: '2026-09-03T12:00:00.000Z',
        suspended_at: '2026-09-20T12:00:00.000Z',
        is_self: false,
        is_last_owner: false,
        actions: {
          roles: ['owner', 'admin', 'editor'],
          suspend: false,
          reactivate: true,
          remove: true,
        },
      },
    ],
    invitations: [
      {
        id: 7,
        email: 'convite@example.com',
        role: 'admin',
        state: 'expired',
        expires_at: '2026-09-25T12:00:00.000Z',
        created_at: '2026-09-22T12:00:00.000Z',
        invited_by: 'Helena Proprietária',
        actions: { resend: true, cancel: true },
      },
    ],
    invite_roles: ['owner', 'admin', 'editor', 'analyst'],
  }
}

describe('OrganizationTeamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists members and pending invitations with their roles and states', () => {
    render(<OrganizationTeamPage {...ownerView()} />)

    const people = screen.getByRole('region', { name: 'Pessoas' })
    expect(within(people).getAllByRole('listitem')).toHaveLength(3)
    expect(within(people).getByText('Helena Proprietária')).toBeVisible()
    expect(screen.getByText('Você')).toBeVisible()
    expect(screen.getByText(/Único proprietário ativo/)).toBeVisible()
    expect(screen.getByText('Suspenso')).toBeVisible()
    expect(screen.getByText('convite@example.com')).toBeVisible()
    expect(screen.getByText('Expirado')).toBeVisible()
    expect(screen.getByText(/Convidado por Helena Proprietária/)).toBeVisible()
    // The owner's own row has no management menu.
    expect(
      screen.queryByRole('button', { name: 'Gerenciar Helena Proprietária' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gerenciar Edu Editor' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Voltar à organização' })).toHaveAttribute(
      'href',
      '/portal/organizations/4'
    )
  })

  it('invites with only the roles the server allows, each explained', async () => {
    const view = ownerView()
    view.invite_roles = ['editor', 'analyst']
    const { user } = render(<OrganizationTeamPage {...view} />)

    await user.click(screen.getByRole('button', { name: 'Convidar pessoa' }))
    const dialog = screen.getByRole('dialog', { name: 'Convidar para Casa Paineira' })

    expect(within(dialog).queryByRole('radio', { name: /Proprietário/ })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('radio', { name: /Administrador/ })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: /Editor/ })).toBeChecked()
    expect(
      within(dialog).getByText(/Acompanha o desempenho e consulta as utilizações/)
    ).toBeVisible()

    await user.type(within(dialog).getByLabelText(/E-mail/), 'nova@example.com')
    await user.click(within(dialog).getByRole('radio', { name: /Analista/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Enviar convite' }))

    expect(mocks.formPost).toHaveBeenCalledWith(
      '/portal/organizations/4/team/invitations',
      { email: 'nova@example.com', role: 'analyst' },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('changes a role from the member menu', async () => {
    const { user } = render(<OrganizationTeamPage {...ownerView()} />)

    await user.click(screen.getByRole('button', { name: 'Gerenciar Edu Editor' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Alterar papel' }))
    const dialog = screen.getByRole('dialog', { name: 'Alterar o papel de Edu Editor' })
    await user.click(within(dialog).getByRole('radio', { name: /Analista/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Salvar papel' }))

    expect(mocks.patch).toHaveBeenCalledWith(
      '/portal/organizations/4/team/members/2',
      { role: 'analyst' },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('confirms before removing someone and reactivates without a detour', async () => {
    const { user } = render(<OrganizationTeamPage {...ownerView()} />)

    await user.click(screen.getByRole('button', { name: 'Gerenciar Edu Editor' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Remover da equipe' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Remover Edu Editor da equipe?' })
    expect(within(confirm).getByText(/Para voltar, será preciso um novo convite/)).toBeVisible()
    expect(mocks.delete).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Remover da equipe' }))
    expect(mocks.delete).toHaveBeenCalledWith(
      '/portal/organizations/4/team/members/2',
      expect.objectContaining({ preserveScroll: true })
    )

    await user.click(screen.getByRole('button', { name: 'Reativar o acesso de Ana Analista' }))
    expect(mocks.patch).toHaveBeenCalledWith(
      '/portal/organizations/4/team/members/3',
      { status: 'active' },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('confirms before cancelling an invitation and resends directly', async () => {
    const { user } = render(<OrganizationTeamPage {...ownerView()} />)

    await user.click(
      screen.getByRole('button', { name: 'Reenviar convite para convite@example.com' })
    )
    expect(mocks.post).toHaveBeenCalledWith(
      '/portal/organizations/4/team/invitations/7/resend',
      {},
      expect.objectContaining({ preserveScroll: true })
    )

    await user.click(
      screen.getByRole('button', { name: 'Cancelar convite para convite@example.com' })
    )
    const confirm = screen.getByRole('alertdialog', {
      name: 'Cancelar o convite para convite@example.com?',
    })
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar convite' }))
    expect(mocks.delete).toHaveBeenCalledWith(
      '/portal/organizations/4/team/invitations/7',
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('shows a read-only team to roles that cannot manage it', () => {
    const view = ownerView()
    view.viewer = { source: 'membership', role: 'analyst' }
    view.invite_roles = []
    view.members = view.members.map((member) => ({ ...member, is_self: false, actions: noActions }))
    view.invitations = view.invitations.map((invitation) => ({
      ...invitation,
      actions: { resend: false, cancel: false },
    }))

    render(<OrganizationTeamPage {...view} />)

    expect(screen.getByText('Você pode ver a equipe, mas não alterá-la')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Convidar pessoa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gerenciar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reenviar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reativar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancelar convite/ })).not.toBeInTheDocument()
  })

  it('explains why a closed organization accepts no invitations', () => {
    const view = ownerView()
    view.organization.accepts_invitations = false
    view.organization.status = 'archived'
    view.invite_roles = []

    render(<OrganizationTeamPage {...view} />)

    expect(screen.getByText('Convites indisponíveis')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Convidar pessoa' })).not.toBeInTheDocument()
  })
})
