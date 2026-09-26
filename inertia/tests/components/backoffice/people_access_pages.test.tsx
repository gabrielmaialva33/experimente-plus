import type { ReactNode } from 'react'

import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PermissionsPage from '~/pages/permissions'
import RolesPage from '~/pages/roles'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({ Head: () => null }))

vi.mock('~/layouts', () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const permissions = [
  { id: 1, name: 'users.list', resource: 'users', action: 'list', context: 'any' },
  { id: 2, name: 'users.update', resource: 'users', action: 'update', context: 'any' },
  { id: 3, name: 'files.delete', resource: 'files', action: 'delete', context: 'own' },
]

// Audit W57/W41: the matrices are reference material and open on request.
describe('people and access pages', () => {
  it('summarises each role and keeps its permissions collapsed', () => {
    render(
      <RolesPage
        roles={[
          {
            id: 1,
            name: 'Admin',
            slug: 'admin',
            description: null,
            users_count: 2,
            permissions,
          },
        ]}
      />
    )

    expect(screen.getByText('2 pessoas')).toBeInTheDocument()
    const summary = screen.getByText('3 permissões em 2 áreas')
    const details = summary.closest('details')!
    expect(details.open).toBe(false)

    fireEvent.click(summary)
    expect(details.open).toBe(true)
  })

  it('lists permissions by area, collapsed, and opens the areas a search matched', () => {
    render(
      <PermissionsPage
        permissions={permissions.map((permission) => ({ ...permission, description: null }))}
      />
    )

    const areas = screen.getByRole('region', { name: 'Permissões por área' })
    const collapsed = areas.querySelectorAll('details')
    expect(collapsed).toHaveLength(2)
    expect([...collapsed].every((details) => !details.open)).toBe(true)

    fireEvent.change(screen.getByLabelText('Buscar permissões'), { target: { value: 'update' } })
    const matched = areas.querySelectorAll('details')
    expect(matched).toHaveLength(1)
    expect(matched[0].open).toBe(true)
  })
})
