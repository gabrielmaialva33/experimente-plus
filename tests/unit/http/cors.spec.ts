import { test } from '@japa/runner'

import corsConfig from '#config/cors'

test.group('CORS configuration', () => {
  test('allows PATCH without opening any browser origin', ({ assert }) => {
    assert.include(corsConfig.methods, 'PATCH')
    assert.deepEqual(corsConfig.origin, [])
  })
})
