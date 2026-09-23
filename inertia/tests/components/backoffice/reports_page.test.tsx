import type { ComponentProps, ReactNode } from 'react'

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import BackofficeReports from '~/pages/backoffice/reports'
import { render } from '~/tests/test_utils'

vi.mock('~/hooks/use_auth', () => ({ useAuth: () => ({ can: () => true }) }))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { get: vi.fn() },
  useForm: () => ({
    data: {},
    setData: vi.fn(),
    transform: vi.fn(),
    post: vi.fn(),
    processing: false,
    errors: {},
  }),
}))

vi.mock('~/layouts/main_layout', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const emptyPage = {
  data: [],
  meta: { total: 0, current_page: 1, last_page: 1 },
}

describe('Report queue page', () => {
  it('shows the overdue total of the whole operation, as the server counted it', () => {
    // An empty page on purpose: the overdue cases sit on other pages or under
    // another filter, and the header must still say they exist. Counting only
    // the rows on screen is what this used to do, and it read zero here.
    render(
      <BackofficeReports
        reports={emptyPage}
        filters={{ status: 'resolved' }}
        tenant_id={1}
        overdue_total={3}
      />
    )

    expect(screen.getByTestId('overdue-total')).toHaveTextContent(
      '3 denúncias vencidas na operação'
    )
  })

  it('says nothing about deadlines when none is missed', () => {
    render(
      <BackofficeReports
        reports={emptyPage}
        filters={{ status: 'pending' }}
        tenant_id={1}
        overdue_total={0}
      />
    )

    expect(screen.queryByTestId('overdue-total')).not.toBeInTheDocument()
  })

  it('uses the singular for one case', () => {
    render(
      <BackofficeReports
        reports={emptyPage}
        filters={{ status: 'pending' }}
        tenant_id={1}
        overdue_total={1}
      />
    )

    expect(screen.getByTestId('overdue-total')).toHaveTextContent('1 denúncia vencida na operação')
  })
})
