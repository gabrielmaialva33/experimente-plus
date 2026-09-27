import type { ComponentProps, ReactNode } from 'react'

import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import BackofficeTodayPage from '~/pages/backoffice/today/index'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

type Props = ComponentProps<typeof BackofficeTodayPage>

const busy: Props = {
  platform_access: 'platform_admin',
  counts: {
    revisions: 1,
    organizations: 1,
    organization_claims: 2,
    content: { 'experiences': 2, 'events': 1, 'showcase-items': 0 },
    reports: 2,
    overdue_reports: 1,
    feedback: 0,
  },
  inbox: [
    {
      source: 'report',
      id: 41,
      target_type: 'review',
      title: null,
      establishment_name: 'Ateliê do Café',
      reason: 'offensive',
      origin: 'user',
      is_anonymous: true,
      received_at: '2026-09-20T11:13:00-03:00',
      due_at: '2026-09-25T11:13:00-03:00',
      overdue: true,
    },
    {
      source: 'report',
      id: 42,
      target_type: 'review',
      title: null,
      establishment_name: 'Casa de Petiscos',
      reason: 'other',
      origin: 'automatic',
      is_anonymous: false,
      received_at: '2026-09-26T10:52:00-03:00',
      due_at: '2026-10-01T10:52:00-03:00',
      overdue: false,
    },
    {
      source: 'content',
      id: 7,
      kind: 'experiences',
      title: 'Oficina de métodos de preparo',
      establishment_name: 'Ateliê do Café',
      received_at: '2026-09-26T09:20:00-03:00',
      due_at: null,
      overdue: false,
    },
    {
      source: 'revision',
      id: 12,
      public_name: 'Casa de Petiscos',
      organization_name: 'Petiscos Ltda.',
      received_at: '2026-09-25T18:04:00-03:00',
      due_at: null,
      overdue: false,
    },
    {
      source: 'organization',
      id: 31,
      trade_name: 'Casa Norte',
      legal_name: 'Casa Norte Alimentos Ltda.',
      received_at: '2026-09-26T14:10:00-03:00',
      due_at: null,
      overdue: false,
    },
  ],
}

describe('Backoffice today', () => {
  it('opens on the counts of every queue, each linking to it', () => {
    render(<BackofficeTodayPage {...busy} />)

    expect(screen.getByRole('heading', { level: 1, name: 'O que resolver hoje' })).toBeVisible()

    const tasks = screen.getByRole('region', { name: 'Pendências de hoje' })
    expect(within(tasks).getByRole('link', { name: 'Analisar organizações' })).toHaveAttribute(
      'href',
      '/backoffice/organizations'
    )
    expect(within(tasks).getByText('2 reivindicações')).toBeVisible()
    expect(within(tasks).getByRole('link', { name: 'Revisar dados' })).toHaveAttribute(
      'href',
      '/backoffice/moderation'
    )
    expect(within(tasks).getByRole('link', { name: 'Revisar conteúdo' })).toHaveAttribute(
      'href',
      '/backoffice/content'
    )
    expect(within(tasks).getByText('3')).toBeVisible()
    expect(within(tasks).getByText('2 experiências · 1 evento')).toBeVisible()
    expect(within(tasks).getByRole('link', { name: 'Revisar denúncias' })).toHaveAttribute(
      'href',
      '/backoffice/reports'
    )
    expect(within(tasks).getByText('1 fora do prazo')).toHaveClass('text-destructive-accent')
    expect(within(tasks).getByRole('link', { name: 'Ler feedback' })).toHaveAttribute(
      'href',
      '/backoffice/feedback?status=new'
    )
    // Nothing new reads quieter than work waiting.
    const feedback = within(tasks)
      .getByRole('heading', { name: 'Feedback do piloto' })
      .closest('[data-slot="task-card"]')
    expect(feedback?.querySelector('[data-slot="task-card-value"]')).toHaveClass(
      'text-muted-foreground'
    )
  })

  it('leaves the feedback card out for a moderator, who cannot read that queue', () => {
    render(
      <BackofficeTodayPage
        {...busy}
        platform_access="platform_moderator"
        counts={{ ...busy.counts, feedback: null, overdue_reports: 0 }}
      />
    )

    const tasks = screen.getByRole('region', { name: 'Pendências de hoje' })
    expect(within(tasks).queryByRole('heading', { name: 'Feedback do piloto' })).toBeNull()
    expect(within(tasks).getByText('Nenhuma fora do prazo')).toHaveClass('text-success-accent')
  })

  it('lists the inbox as a table whose rows say what, where from, when and where to act', () => {
    render(<BackofficeTodayPage {...busy} />)

    const table = screen.getByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
    ).toEqual(['Tipo', 'Item', 'Origem', 'Recebido', 'Prazo', 'Ação'])

    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(5)

    const late = rows[0]
    expect(within(late).getAllByText('Denúncia')).not.toHaveLength(0)
    // A report asks for attention (amber); orange is reserved for conversion.
    for (const badge of within(late).getAllByText('Denúncia')) {
      expect(badge).toHaveClass('bg-warning-soft', 'text-warning-accent')
      expect(badge.className).not.toMatch(/\bbg-cta\b/)
    }
    expect(within(late).getByText('Avaliação · Ateliê do Café')).toBeVisible()
    expect(within(late).getByText('Conteúdo ofensivo')).toBeVisible()
    expect(within(late).getAllByText('Pessoa anônima')).not.toHaveLength(0)
    expect(within(late).getByText('Venceu 25/09', { selector: 'span' })).toBeVisible()
    expect(
      within(late).getByRole('link', { name: 'Revisar: Avaliação · Ateliê do Café' })
    ).toHaveAttribute('href', '/backoffice/reports')

    expect(within(rows[1]).getAllByText('Moderação automática')).not.toHaveLength(0)
    expect(within(rows[1]).getAllByText('01/10')).not.toHaveLength(0)

    expect(
      within(rows[2]).getByRole('link', { name: 'Revisar: Oficina de métodos de preparo' })
    ).toHaveAttribute('href', '/backoffice/content?kind=experiences')
    expect(within(rows[2]).getAllByText('Experiência')).not.toHaveLength(0)

    expect(within(rows[3]).getAllByText('Dados do lugar')).not.toHaveLength(0)
    expect(within(rows[3]).getAllByText('Petiscos Ltda.')).not.toHaveLength(0)
    expect(
      within(rows[3]).getByRole('link', { name: 'Revisar: Casa de Petiscos' })
    ).toHaveAttribute('href', '/backoffice/moderation/12')
    expect(within(rows[3]).getByText('Sem prazo')).toBeInTheDocument()

    expect(within(rows[4]).getAllByText('Organização')).not.toHaveLength(0)
    expect(within(rows[4]).getByText('Casa Norte Alimentos Ltda.')).toBeVisible()
    expect(within(rows[4]).getByRole('link', { name: 'Revisar: Casa Norte' })).toHaveAttribute(
      'href',
      '/backoffice/organizations/31'
    )
  })

  it('says so when nothing is waiting', () => {
    render(
      <BackofficeTodayPage
        platform_access="platform_moderator"
        counts={{
          revisions: 0,
          organizations: 0,
          organization_claims: 0,
          content: { 'experiences': 0, 'events': 0, 'showcase-items': 0 },
          reports: 0,
          overdue_reports: 0,
          feedback: null,
        }}
        inbox={[]}
      />
    )

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Nada para resolver agora' })).toBeVisible()
    expect(screen.getByText('Nenhuma revisão esperando.')).toBeVisible()
    expect(screen.getByText('Nenhum negócio esperando.')).toBeVisible()
    expect(screen.getByText('Nada em análise.')).toBeVisible()
  })
})
