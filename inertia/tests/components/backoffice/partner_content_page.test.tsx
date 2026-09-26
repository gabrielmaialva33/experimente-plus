import type { ComponentProps, ReactNode } from 'react'

import { act, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BackofficePartnerContentPage from '~/pages/backoffice/content'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({
    can: (permission: string) => mocks.permissions.includes(permission),
  }),
}))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
  },
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const pendingEvent = {
  id: 22,
  establishment_id: 7,
  title: 'Noite de jazz',
  description: 'Programação do sábado.',
  status: 'pending_review',
  starts_at: '2026-09-20T22:00:00.000Z',
  ends_at: '2026-09-21T01:00:00.000Z',
  published_snapshot: {
    title: 'Noite de jazz — versão anterior',
    starts_at: '2026-09-20T21:00:00.000Z',
    ends_at: '2026-09-21T00:00:00.000Z',
  },
  establishment: {
    id: 7,
    organization: { trade_name: 'Café Norte' },
    published_revision: {
      public_name: 'Café Central',
      city: { timezone: 'America/Sao_Paulo' },
    },
  },
}

describe('BackofficePartnerContentPage', () => {
  beforeEach(() => {
    mocks.permissions = []
    mocks.get.mockReset()
    mocks.post.mockReset()
    mocks.put.mockReset()
  })

  it('lets moderators approve/reject while keeping tenant policy hidden', async () => {
    mocks.permissions = ['establishments.approve', 'establishments.reject']

    const { user } = render(
      <BackofficePartnerContentPage
        tenant_id={7}
        sections={[
          {
            kind: 'events',
            data: [pendingEvent],
            meta: { current_page: 1, last_page: 1, total: 1 },
          },
        ]}
        counts={{ 'experiences': 0, 'events': 1, 'showcase-items': 0 }}
        filters={{ kind: 'events', status: 'pending_review', per_page: 20 }}
        policy={null}
        platform_access="platform_moderator"
      />
    )

    expect(screen.getByText('versão pública anterior preservada')).toBeVisible()
    expect(screen.queryByText('Política da operação')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Aprovar' }))
    expect(mocks.post).toHaveBeenCalledWith(
      '/backoffice/content/events/22/approve',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
    const approveOptions = mocks.post.mock.calls[0]?.[2] as { onFinish?: () => void } | undefined
    await act(async () => {
      approveOptions?.onFinish?.()
    })

    await user.click(screen.getByRole('button', { name: 'Recusar' }))
    expect(screen.getByText('Recusar esta versão?')).toBeVisible()
  })

  it('lets platform admins change the policy when settings.update is granted', async () => {
    mocks.permissions = ['settings.update']

    const { user } = render(
      <BackofficePartnerContentPage
        tenant_id={7}
        sections={[{ kind: 'events', data: [], meta: { current_page: 1, last_page: 1, total: 0 } }]}
        counts={{ 'experiences': 0, 'events': 0, 'showcase-items': 0 }}
        filters={{ kind: 'events', status: 'pending_review', per_page: 20 }}
        policy={{
          require_experience_approval: false,
          require_event_approval: true,
          require_showcase_item_approval: false,
          max_media_per_content: 4,
          min_event_notice_minutes: 60,
        }}
        platform_access="platform_admin"
      />
    )

    expect(screen.getByText('Política da operação')).toBeVisible()
    expect(screen.getByLabelText('Máximo de mídias por conteúdo')).toHaveValue(4)
    expect(screen.getByLabelText('Antecedência mínima do evento')).toHaveValue(60)

    await user.clear(screen.getByLabelText('Antecedência mínima do evento'))
    await user.type(screen.getByLabelText('Antecedência mínima do evento'), '120')
    await user.click(screen.getByRole('button', { name: 'Salvar política' }))

    expect(mocks.put).toHaveBeenCalledWith(
      '/backoffice/content/policy',
      expect.objectContaining({
        require_event_approval: true,
        max_media_per_content: 4,
        min_event_notice_minutes: 120,
      }),
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('opens on every kind, so an item waiting in another kind is never hidden', () => {
    mocks.permissions = ['establishments.approve']

    render(
      <BackofficePartnerContentPage
        tenant_id={7}
        sections={[
          {
            kind: 'experiences',
            data: [{ ...pendingEvent, id: 31, title: 'Oficina de preparo', starts_at: null }],
            meta: { current_page: 1, last_page: 1, total: 1 },
          },
          { kind: 'events', data: [], meta: { current_page: 1, last_page: 1, total: 0 } },
          {
            kind: 'showcase-items',
            data: [],
            meta: { current_page: 1, last_page: 1, total: 0 },
          },
        ]}
        counts={{ 'experiences': 1, 'events': 0, 'showcase-items': 0 }}
        filters={{ kind: 'all', status: 'pending_review', per_page: 20 }}
        policy={null}
        platform_access="platform_moderator"
      />
    )

    const tabs = screen.getByRole('navigation', { name: 'Tipos de conteúdo' })
    expect(tabs).toHaveTextContent('Todos os tipos1')
    expect(tabs).toHaveTextContent('Experiências1')
    expect(screen.getByRole('link', { name: /Todos os tipos/ })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('heading', { name: /Experiências/, level: 2 })).toBeVisible()
    expect(screen.getByText('Oficina de preparo')).toBeVisible()
    expect(screen.queryByRole('heading', { name: /Eventos/, level: 2 })).not.toBeInTheDocument()
  })

  it('points to the other kinds when the selected one is empty', () => {
    render(
      <BackofficePartnerContentPage
        tenant_id={7}
        sections={[{ kind: 'events', data: [], meta: { current_page: 1, last_page: 1, total: 0 } }]}
        counts={{ 'experiences': 1, 'events': 0, 'showcase-items': 0 }}
        filters={{ kind: 'events', status: 'pending_review', per_page: 20 }}
        policy={null}
        platform_access="platform_moderator"
      />
    )

    expect(screen.getByText('Nenhum item de eventos em análise')).toBeVisible()
    expect(screen.getByText(/Há itens de outros tipos neste estado/)).toBeVisible()
  })

  it('refuses only with a written reason, and sends it', async () => {
    mocks.permissions = ['establishments.reject']

    const { user } = render(
      <BackofficePartnerContentPage
        tenant_id={7}
        sections={[
          {
            kind: 'events',
            data: [pendingEvent],
            meta: { current_page: 1, last_page: 1, total: 1 },
          },
        ]}
        counts={{ 'experiences': 0, 'events': 1, 'showcase-items': 0 }}
        filters={{ kind: 'events', status: 'pending_review', per_page: 20 }}
        policy={null}
        platform_access="platform_moderator"
      />
    )

    await user.click(screen.getByRole('button', { name: 'Recusar' }))
    const confirm = screen.getByRole('button', { name: 'Recusar versão' })
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText('Motivo da recusa'), 'ok')
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo da recusa'), ' — a data não confere')
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    expect(mocks.post).toHaveBeenCalledWith(
      '/backoffice/content/events/22/reject',
      { reason: 'ok — a data não confere' },
      expect.objectContaining({ preserveScroll: true })
    )
  })
})
