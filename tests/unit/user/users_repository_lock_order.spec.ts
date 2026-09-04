import { test } from '@japa/runner'

import { orderUserIdsForLock } from '#modules/users/repositories/users_repository'

test.group('Administrative user lock order', () => {
  test('deduplicates and orders actor/target ids before row locking', ({ assert }) => {
    assert.deepEqual(orderUserIdsForLock([42, 7, 42, 19]), [7, 19, 42])
  })
})
