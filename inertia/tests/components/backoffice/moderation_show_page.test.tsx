import type { ComponentProps, ReactNode } from 'react'

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ModerationRevisionPage from '~/pages/backoffice/moderation/show'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePage: () => ({ props: { errors: {} } }),
  useForm: () => ({
    data: {},
    setData: vi.fn(),
    post: vi.fn(),
    processing: false,
    errors: {},
    reset: vi.fn(),
    transform: vi.fn(),
    clearErrors: vi.fn(),
  }),
  router: { post: vi.fn() },
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const published = {
  'identity.public_name': 'Casa de Petiscos',
  'contacts.public_phone': '43999990000',
  'hours.1': '08:00–23:00',
}

function renderPage(
  comparison: ComponentProps<typeof ModerationRevisionPage>['comparison'],
  gate: Record<string, unknown> = { blocking_issues: [], warnings: [] }
) {
  return render(
    <ModerationRevisionPage
      revision={{
        id: 7,
        version: 3,
        status: 'pending_review',
        public_name: 'Casa de Petiscos',
        media: [],
      }}
      comparison={comparison}
      publication_gate={gate}
      review_issues={[]}
      events={[]}
    />
  )
}

describe('ModerationRevisionPage', () => {
  it('shows every section of the place and marks what changed since the published version', async () => {
    renderPage({
      published_version: 2,
      submitted: { ...published, 'contacts.public_phone': '43988881111' },
      published,
      labels: {},
    })

    expect(screen.getByRole('heading', { level: 1, name: 'Casa de Petiscos' })).toBeInTheDocument()
    expect(screen.getByText('1 campo alterado')).toBeInTheDocument()
    for (const title of [
      'Identificação',
      'Contatos',
      'Endereço',
      'Horários',
      'Categorias',
      'Fotos',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    }
    const contacts = screen.getByRole('region', { name: 'Contatos' })
    expect(within(contacts).getByText('(43) 98888-1111')).toBeInTheDocument()
    expect(within(contacts).getByText('Antes: (43) 99999-0000')).toBeInTheDocument()
    expect(within(contacts).getByText('(alterado)')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Mostrar só o que mudou' }))
    expect(screen.queryByRole('region', { name: 'Horários' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Contatos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Decidir' })).toHaveAttribute('href', '#decisao')
  })

  it('says a first publication instead of pretending nothing changed', () => {
    renderPage({ published_version: null, submitted: published, published: null, labels: {} })

    expect(screen.getByText('Primeira publicação')).toBeInTheDocument()
    expect(
      screen.queryByRole('checkbox', { name: 'Mostrar só o que mudou' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Antes:/)).not.toBeInTheDocument()
  })

  it('says in Portuguese what blocks the publication', () => {
    renderPage(undefined, {
      blocking_issues: [
        {
          code: 'review_issues_open',
          field: 'review_issues',
          message: 'Blocking review issues must be resolved before publication',
          severity: 'blocking',
        },
      ],
      warnings: [],
    })

    expect(
      screen.getByText('Resolva as pendências de moderação que bloqueiam a publicação.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/Blocking review issues/)).not.toBeInTheDocument()
  })
})
