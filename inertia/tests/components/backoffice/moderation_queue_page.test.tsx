import type { ComponentProps, ReactNode } from 'react'

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ModerationQueuePage from '~/pages/backoffice/moderation/index'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { get: vi.fn() },
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

describe('ModerationQueuePage', () => {
  it('states the waiting count once, in the header, and opens each version to review', () => {
    render(
      <ModerationQueuePage
        revisions={{
          data: [
            {
              id: 12,
              version: 3,
              status: 'pending_review',
              public_name: 'Casa de Petiscos',
              organization_name: 'Grupo Norte',
              city_name: 'Londrina',
              submitted_at: '2026-09-25T18:04:00-03:00',
            },
          ],
          meta: { total: 1, current_page: 1, last_page: 1 },
        }}
        filters={{}}
      />
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Dados de lugares para revisar' })
    ).toBeInTheDocument()
    expect(screen.getAllByText('1 versão esperando')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Revisar/ })).toHaveAttribute(
      'href',
      '/backoffice/moderation/12'
    )
    expect(screen.getByText(/Enviada em/)).toBeInTheDocument()
  })

  it('explains an empty queue in terms of what fills it', () => {
    render(<ModerationQueuePage revisions={{ data: [], meta: { total: 0 } }} filters={{}} />)

    expect(screen.getByText('Nada para revisar')).toBeInTheDocument()
    // An empty queue is not a warning: amber stays for work waiting.
    expect(screen.getByText('Nada esperando')).toHaveClass('bg-muted')
    expect(screen.getByText('Nada esperando')).not.toHaveClass('bg-warning-soft')
  })
})
