import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OrganizationInvitationAcceptPage, {
  type OrganizationInvitationAcceptPageProps,
} from '~/pages/organization_invitations/accept'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  flashError: null as string | null,
}))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { post: mocks.post },
  usePage: () => ({
    url: '/organization-invitations/accept',
    props: {
      app: { name: 'Experimente+', demoPagesEnabled: false },
      flash: { error: mocks.flashError },
    },
  }),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => null,
}))

const RETURN = '?next=%2Forganization-invitations%2Faccept'

function props(
  overrides: Partial<OrganizationInvitationAcceptPageProps> = {}
): OrganizationInvitationAcceptPageProps {
  return {
    state: 'open',
    invitation: {
      organization_name: 'Casa Paineira',
      role: 'editor',
      inviter_name: 'Helena',
      expires_at: '2026-09-30T15:00:00.000Z',
      email_hint: 'co•••@example.com',
    },
    viewer: { signed_in: false, email: null, matches: false, membership: null, accepted: false },
    portal_path: null,
    ...overrides,
  }
}

describe('OrganizationInvitationAcceptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.flashError = null
  })

  it('explains the invitation to a visitor and returns here after sign-in or sign-up', () => {
    render(<OrganizationInvitationAcceptPage {...props()} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Convite para Casa Paineira' })
    ).toBeVisible()
    expect(screen.getByText('Helena convidou você para a equipe como Editor.')).toBeVisible()
    expect(screen.getByText(/Atualiza lugares, experiências e benefícios/)).toBeVisible()
    expect(screen.getByText('co•••@example.com')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Entrar para aceitar' })).toHaveAttribute(
      'href',
      `/login${RETURN}`
    )
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      `/register${RETURN}`
    )
    expect(screen.queryByRole('button', { name: 'Aceitar convite' })).not.toBeInTheDocument()
  })

  it('accepts for the invited account', async () => {
    const { user } = render(
      <OrganizationInvitationAcceptPage
        {...props({
          viewer: {
            signed_in: true,
            email: 'convidada@example.com',
            matches: true,
            membership: null,
            accepted: false,
          },
        })}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Aceitar convite' }))

    expect(mocks.post).toHaveBeenCalledWith(
      '/organization-invitations/accept',
      {},
      expect.objectContaining({ onFinish: expect.any(Function) })
    )
  })

  it('offers another account to someone signed in with a different address', async () => {
    const { user } = render(
      <OrganizationInvitationAcceptPage
        {...props({
          viewer: {
            signed_in: true,
            email: 'outra@example.com',
            matches: false,
            membership: null,
            accepted: false,
          },
        })}
      />
    )

    expect(screen.getByText('outra@example.com')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Aceitar convite' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sair e entrar com outra conta' }))

    expect(mocks.post).toHaveBeenCalledWith(
      '/logout',
      { next: '/organization-invitations/accept' },
      expect.any(Object)
    )
  })

  it('sends an existing member to the organization and keeps a suspended one out', () => {
    const { unmount } = render(
      <OrganizationInvitationAcceptPage
        {...props({
          viewer: {
            signed_in: true,
            email: 'convidada@example.com',
            matches: true,
            membership: 'active',
            accepted: false,
          },
          portal_path: '/portal/organizations/4',
        })}
      />
    )
    expect(screen.getByRole('link', { name: 'Ir para a organização' })).toHaveAttribute(
      'href',
      '/portal/organizations/4'
    )
    unmount()

    render(
      <OrganizationInvitationAcceptPage
        {...props({
          viewer: {
            signed_in: true,
            email: 'convidada@example.com',
            matches: true,
            membership: 'suspended',
            accepted: false,
          },
        })}
      />
    )
    expect(screen.getByText(/Seu acesso a esta organização está suspenso/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Aceitar convite' })).not.toBeInTheDocument()
  })

  it('sends whoever accepted back through sign-in and tells anyone else to ask again', () => {
    const { unmount } = render(
      <OrganizationInvitationAcceptPage {...props({ state: 'accepted' })} />
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Convite já aceito' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    unmount()

    render(
      <OrganizationInvitationAcceptPage
        {...props({
          state: 'accepted',
          viewer: {
            signed_in: true,
            email: 'outra@example.com',
            matches: false,
            membership: null,
            accepted: false,
          },
        })}
      />
    )
    expect(screen.getByText(/aceito por outra conta/)).toBeVisible()
  })

  it.each([
    ['expired', 'Convite expirado'],
    ['revoked', 'Convite cancelado'],
    ['unavailable', 'Convite indisponível'],
  ] as const)('explains a %s invitation and what to do next', (state, title) => {
    render(<OrganizationInvitationAcceptPage {...props({ state })} />)

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeVisible()
    expect(screen.getByText(/Peça um novo convite/)).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Entrar para aceitar' })).not.toBeInTheDocument()
  })

  it('handles an unknown or missing link without naming an organization', () => {
    const { unmount } = render(
      <OrganizationInvitationAcceptPage {...props({ state: 'invalid', invitation: null })} />
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Link de convite inválido' })
    ).toBeVisible()
    unmount()

    render(<OrganizationInvitationAcceptPage {...props({ state: 'missing', invitation: null })} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Nenhum convite aberto' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Explorar o catálogo' })).toHaveAttribute(
      'href',
      '/cidades'
    )
  })

  it('shows the reason a previous attempt failed', () => {
    mocks.flashError = 'Este convite expirou. Peça a quem convidou você para reenviá-lo.'

    render(<OrganizationInvitationAcceptPage {...props()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Este convite expirou.')
  })
})
