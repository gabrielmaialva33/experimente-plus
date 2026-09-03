import { test } from '@japa/runner'

import { resolveActiveTenantId } from '#shared/utils/active_tenant'

const tenants = [{ id: 11 }, { id: 22 }]

test.group('Active tenant resolution', () => {
  test('uses the claimed accessible tenant instead of membership order', ({ assert }) => {
    assert.equal(resolveActiveTenantId(tenants, 22), 22)
  })

  test('does not fall back when an explicit claim is stale or invalid', ({ assert }) => {
    assert.isNull(resolveActiveTenantId(tenants, 99))

    for (const invalidClaim of [null, '22', 0, -1, 1.5]) {
      assert.isNull(resolveActiveTenantId(tenants, invalidClaim))
    }
  })

  test('keeps the deterministic fallback only for a missing claim', ({ assert }) => {
    assert.equal(resolveActiveTenantId(tenants), 11)
    assert.isNull(resolveActiveTenantId([]))
  })
})
