import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'

import { mapUserUniqueConstraintError } from '#modules/users/utils/user_unique_constraint_error'

type DatabaseError = Error & { code: string; constraint: string }

function databaseError(code: string, constraint: string): DatabaseError {
  return Object.assign(new Error('database write failed'), { code, constraint })
}

test.group('User unique constraint error', () => {
  for (const expectation of [
    {
      constraint: 'users_email_unique',
      field: 'email',
      message: 'The email has already been taken',
    },
    {
      constraint: 'users_username_unique',
      field: 'username',
      message: 'The username has already been taken',
    },
  ] as const) {
    test(`maps ${expectation.constraint} to the canonical validation error`, ({ assert }) => {
      const cause = databaseError('23505', expectation.constraint)
      const mapped = mapUserUniqueConstraintError(cause, ['email', 'username'])

      assert.instanceOf(mapped, errors.E_VALIDATION_ERROR)
      assert.deepEqual((mapped as { messages: unknown }).messages, [
        {
          field: expectation.field,
          rule: 'database.unique',
          message: expectation.message,
        },
      ])
      assert.strictEqual((mapped as Error).cause, cause)
    })
  }

  test('preserves disallowed and unrelated errors by identity', ({ assert }) => {
    const disallowed = databaseError('23505', 'users_email_unique')
    const unknownConstraint = databaseError('23505', 'users_external_id_unique')
    const unrelated = databaseError('40001', 'users_username_unique')

    assert.strictEqual(mapUserUniqueConstraintError(disallowed, ['username']), disallowed)
    assert.strictEqual(
      mapUserUniqueConstraintError(unknownConstraint, ['email', 'username']),
      unknownConstraint
    )
    assert.strictEqual(mapUserUniqueConstraintError(unrelated, ['email', 'username']), unrelated)
  })
})
