import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'

import type UsersRepository from '#modules/users/repositories/users_repository'
import UpdateProfileService from '#modules/users/services/update_profile_service'

type DatabaseError = Error & { code: string; constraint: string }

function databaseError(code: string, constraint: string): DatabaseError {
  return Object.assign(new Error('database write failed'), { code, constraint })
}

async function captureFailure(callback: () => Promise<unknown>): Promise<unknown> {
  try {
    await callback()
  } catch (error) {
    return error
  }

  throw new Error('Expected the callback to fail')
}

test.group('Update profile service', () => {
  test('maps only the username unique constraint to the canonical Vine error', async ({
    assert,
  }) => {
    const cause = databaseError('23505', 'users_username_unique')
    const repository = {
      async update() {
        throw cause
      },
    } as unknown as UsersRepository
    const service = new UpdateProfileService(repository)

    const failure = await captureFailure(() => service.run(17, { username: 'already-taken' }))

    assert.instanceOf(failure, errors.E_VALIDATION_ERROR)
    assert.deepEqual((failure as { messages: unknown }).messages, [
      {
        field: 'username',
        rule: 'database.unique',
        message: 'The username has already been taken',
      },
    ])
    assert.strictEqual((failure as Error).cause, cause)
  })

  test('rethrows unrelated database failures by identity', async ({ assert }) => {
    const failures = [
      databaseError('23505', 'users_email_unique'),
      databaseError('40001', 'users_username_unique'),
    ]

    for (const expected of failures) {
      const repository = {
        async update() {
          throw expected
        },
      } as unknown as UsersRepository
      const service = new UpdateProfileService(repository)

      const actual = await captureFailure(() => service.run(17, { username: 'candidate' }))

      assert.strictEqual(actual, expected)
    }
  })
})
