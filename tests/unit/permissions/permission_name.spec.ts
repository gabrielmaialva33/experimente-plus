import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { canonicalPermissionName } from '#modules/permissions/permission_name'
import { mapPermissionNameUniqueConstraintError } from '#modules/permissions/permission_unique_constraint_error'

type DatabaseError = Error & { code: string; constraint: string }

function databaseError(code: string, constraint: string): DatabaseError {
  return Object.assign(new Error('database write failed'), { code, constraint })
}

test.group('Permission name contract', () => {
  test('derives the stable name from the permission tuple', ({ assert }) => {
    assert.equal(
      canonicalPermissionName(IPermission.Resources.REPORTS, IPermission.Actions.IMPORT),
      'reports.import'
    )
    assert.equal(
      canonicalPermissionName(
        IPermission.Resources.FILES,
        IPermission.Actions.DELETE,
        IPermission.Contexts.OWN
      ),
      'files.delete.own'
    )
  })

  test('maps only permissions_name_unique to the canonical validation error', ({ assert }) => {
    const cause = databaseError('23505', 'permissions_name_unique')
    const mapped = mapPermissionNameUniqueConstraintError(cause)

    assert.instanceOf(mapped, errors.E_VALIDATION_ERROR)
    assert.deepEqual((mapped as { messages: unknown }).messages, [
      {
        field: 'name',
        rule: 'database.unique',
        message: 'The canonical permission name is already assigned to another permission tuple',
      },
    ])
    assert.strictEqual((mapped as Error).cause, cause)
  })

  test('preserves unrelated database errors by identity', ({ assert }) => {
    const otherConstraint = databaseError('23505', 'permissions_resource_action_context_unique')
    const otherCode = databaseError('40001', 'permissions_name_unique')
    const plainError = new Error('unexpected failure')

    assert.strictEqual(mapPermissionNameUniqueConstraintError(otherConstraint), otherConstraint)
    assert.strictEqual(mapPermissionNameUniqueConstraintError(otherCode), otherCode)
    assert.strictEqual(mapPermissionNameUniqueConstraintError(plainError), plainError)
  })
})
