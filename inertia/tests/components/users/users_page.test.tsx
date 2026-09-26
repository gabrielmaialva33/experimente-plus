import type { ReactNode } from 'react'

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import UsersPage from '~/pages/users'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  router: { get: vi.fn(), delete: vi.fn() },
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({ can: () => false }),
}))

vi.mock('~/layouts', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

describe('UsersPage', () => {
  // Web audit W20: the roles column showed the database names "User" and "Root".
  it('names each role in Portuguese, by its slug', () => {
    render(
      <UsersPage
        users={{
          meta: {
            total: 1,
            per_page: 10,
            current_page: 1,
            last_page: 1,
            first_page: 1,
            first_page_url: '/users?page=1',
            last_page_url: '/users?page=1',
            next_page_url: null,
            previous_page_url: null,
          },
          data: [
            {
              id: 1,
              full_name: 'Ana Souza',
              email: 'ana@example.com',
              username: 'ana',
              email_verified_at: null,
              created_at: '2026-09-01T12:00:00.000Z',
              roles: [
                { id: 1, slug: 'root', name: 'Root' },
                { id: 4, slug: 'user', name: 'User' },
              ],
            },
          ],
        }}
        search=""
        sortBy="created_at"
        direction="desc"
      />
    )

    expect(screen.getByText('Responsável técnico')).toBeInTheDocument()
    expect(screen.getByText('Explorador')).toBeInTheDocument()
    expect(screen.queryByText('User')).not.toBeInTheDocument()
  })
})
