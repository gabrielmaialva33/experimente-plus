import type { ComponentProps, ReactNode } from 'react'

import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import FilesPage from '~/pages/files'
import { render } from '~/tests/test_utils'

const mocks = vi.hoisted(() => ({ destroy: vi.fn() }))

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { delete: mocks.destroy },
}))

vi.mock('~/hooks/use_auth', () => ({
  useAuth: () => ({ user: { id: 1 }, can: (permission: string) => permission === 'files.delete' }),
}))

vi.mock('~/layouts', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const meta = {
  total: 1,
  perPage: 20,
  currentPage: 1,
  lastPage: 1,
  firstPage: 1,
  nextPageUrl: null,
  previousPageUrl: null,
}

describe('FilesPage', () => {
  // Audit W46/W47: one quiet delete per row, confirmed before it happens, and
  // no MIME type in the row.
  it('deletes only after confirming and keeps the technical format out of the row', async () => {
    const { user } = render(
      <FilesPage
        files={{
          meta,
          data: [
            {
              id: 5,
              client_name: 'cardapio.pdf',
              file_name: 'a1b2.pdf',
              file_size: 2048,
              file_type: 'application/pdf',
              file_category: 'document',
              url: '/files/5',
              owner: { id: 2, full_name: 'Ana Souza' },
              created_at: '2026-09-20T12:00:00.000Z',
            },
          ],
        }}
      />
    )

    expect(screen.queryByText(/application\/pdf/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Excluir/ })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Excluir cardapio.pdf' }))
    expect(mocks.destroy).not.toHaveBeenCalled()
    expect(await screen.findByText('Excluir arquivo?')).toBeVisible()
  })
})
