import type { ComponentProps, ReactNode } from 'react'

import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PartnerContentPage from '~/pages/portal/content'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: {
    post: mocks.post,
    put: mocks.put,
  },
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const establishment = {
  id: 7,
  organization_id: 3,
  organization_name: 'Café Norte Ltda.',
  public_name: 'Café Central',
  city: {
    id: 2,
    name: 'Londrina',
    state_code: 'PR',
    timezone: 'America/Sao_Paulo',
  },
  allowed_actions: {
    update: true,
    submit: true,
    archive: true,
  },
}

describe('PartnerContentPage', () => {
  beforeEach(() => {
    mocks.post.mockReset()
    mocks.put.mockReset()
    window.scrollTo = vi.fn()
  })

  it('creates an event using the establishment city timezone', async () => {
    const { user } = render(
      <PartnerContentPage
        tenant_id={7}
        establishments={[establishment]}
        content={{ experiences: [], events: [], showcase_items: [] }}
      />
    )

    await user.click(screen.getByRole('tab', { name: /Eventos/ }))
    await user.selectOptions(screen.getByLabelText('Unidade'), String(establishment.id))
    await user.type(screen.getByLabelText('Título'), 'Noite de jazz')
    fireEvent.change(screen.getByLabelText('Início'), {
      target: { value: '2026-09-20T19:00' },
    })
    fireEvent.change(screen.getByLabelText('Fim'), {
      target: { value: '2026-09-20T22:00' },
    })
    await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

    expect(mocks.post).toHaveBeenCalledOnce()
    const [path, payload] = mocks.post.mock.calls[0]
    expect(path).toBe('/portal/content/events')
    expect(payload).toMatchObject({
      establishment_id: 7,
      title: 'Noite de jazz',
      starts_at: '2026-09-20T22:00:00.000Z',
      ends_at: '2026-09-21T01:00:00.000Z',
    })
  })

  it('explains that an approved snapshot stays public while an edit waits', () => {
    render(
      <PartnerContentPage
        tenant_id={7}
        establishments={[establishment]}
        content={{
          experiences: [
            {
              id: 15,
              establishment_id: 7,
              title: 'Versão nova',
              description: 'Aguardando revisão.',
              status: 'pending_review',
              published_snapshot: {
                title: 'Versão aprovada',
                description: 'Ainda pública.',
              },
            },
          ],
          events: [],
          showcase_items: [],
        }}
      />
    )

    expect(screen.getByText('versão anterior continua pública')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
  })

  it('keeps a read-only partner from receiving mutation controls', () => {
    render(
      <PartnerContentPage
        tenant_id={7}
        establishments={[
          {
            ...establishment,
            allowed_actions: { update: false, submit: false, archive: false },
          },
        ]}
        content={{
          experiences: [
            {
              id: 16,
              establishment_id: 7,
              title: 'Experiência publicada',
              status: 'published',
              published_snapshot: { title: 'Experiência publicada' },
            },
          ],
          events: [],
          showcase_items: [],
        }}
      />
    )

    expect(screen.queryByRole('button', { name: 'Criar rascunho' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Unidade' })).toHaveAttribute(
      'href',
      '/portal/establishments/7'
    )
  })
})
