import { errors } from '@vinejs/vine'

const PERMISSION_NAME_UNIQUE_CONSTRAINT = 'permissions_name_unique'

/**
 * Converts only the known canonical-name collision into the validation
 * response used by Vine. Every unrelated database error is preserved.
 */
export function mapPermissionNameUniqueConstraintError(error: unknown): unknown {
  if (
    !error ||
    typeof error !== 'object' ||
    !('code' in error) ||
    error.code !== '23505' ||
    !('constraint' in error) ||
    error.constraint !== PERMISSION_NAME_UNIQUE_CONSTRAINT
  ) {
    return error
  }

  return new errors.E_VALIDATION_ERROR(
    [
      {
        field: 'name',
        rule: 'database.unique',
        message: 'The canonical permission name is already assigned to another permission tuple',
      },
    ],
    { cause: error }
  )
}
