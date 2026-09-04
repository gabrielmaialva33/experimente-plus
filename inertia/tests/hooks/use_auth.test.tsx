import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '~/hooks/use_auth'

const pageState = vi.hoisted(() => ({
  activeTenantId: null as number | null,
  platformAccess: null as 'platform_admin' | 'platform_moderator' | null,
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
        platformAccess: pageState.platformAccess,
        permissions: [],
      },
    },
  }),
}))

describe('useAuth', () => {
  beforeEach(() => {
    pageState.activeTenantId = null
    pageState.platformAccess = null
  })

  it('does not invent an active operation when shared props intentionally resolve none', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.activeTenantId).toBeNull()
    expect(result.current.activeTenant).toBeNull()
    expect(result.current.tenants).toHaveLength(2)
    expect(result.current.platformAccess).toBeNull()
    expect(result.current.isPlatformStaff).toBe(false)
  })

  it('resolves the exact operation selected by the server', () => {
    pageState.activeTenantId = 22
    const { result } = renderHook(() => useAuth())

    expect(result.current.activeTenant).toMatchObject({ id: 22, name: 'Operação B' })
  })

  it('exposes only the canonical platform access shared by the server', () => {
    pageState.platformAccess = 'platform_moderator'
    const { result } = renderHook(() => useAuth())

    expect(result.current.platformAccess).toBe('platform_moderator')
    expect(result.current.isPlatformStaff).toBe(true)
  })
})
