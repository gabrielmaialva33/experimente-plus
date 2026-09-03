import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '~/hooks/use_auth'

const pageState = vi.hoisted(() => ({
  activeTenantId: null as number | null,
}))

vi.mock('@inertiajs/react', () => ({
  usePage: () => ({
    props: {
      auth: {
        user: { id: 1, full_name: 'Ana Souza', email: 'ana@example.test' },
        tenants: [
          { id: 11, name: 'Operação A', slug: 'operacao-a', is_active: true, role: 'member' },
          { id: 22, name: 'Operação B', slug: 'operacao-b', is_active: true, role: 'owner' },
        ],
        activeTenantId: pageState.activeTenantId,
        permissions: [],
      },
    },
  }),
}))

describe('useAuth', () => {
  beforeEach(() => {
    pageState.activeTenantId = null
  })

  it('does not invent an active operation when shared props intentionally resolve none', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.activeTenantId).toBeNull()
    expect(result.current.activeTenant).toBeNull()
    expect(result.current.tenants).toHaveLength(2)
  })

  it('resolves the exact operation selected by the server', () => {
    pageState.activeTenantId = 22
    const { result } = renderHook(() => useAuth())

    expect(result.current.activeTenant).toMatchObject({ id: 22, name: 'Operação B' })
  })
})
