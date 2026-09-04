import { errors } from '@vinejs/vine'

export type UserUniqueField = 'email' | 'username'

const USER_UNIQUE_CONSTRAINTS = {
  users_email_unique: {
    field: 'email',
    message: 'The email has already been taken',
  },
  users_username_unique: {
    field: 'username',
    message: 'The username has already been taken',
  },
} as const

/**
 * Converts only known PostgreSQL user uniqueness violations into the same
 * validation contract exposed by Vine's database.unique rule. The database
 * remains authoritative when concurrent requests pass the preflight check.
 */
export function mapUserUniqueConstraintError(
  error: unknown,
  allowedFields: readonly UserUniqueField[]
): unknown {
  if (
    !error ||
    typeof error !== 'object' ||
    !('code' in error) ||
    error.code !== '23505' ||
    !('constraint' in error) ||
    typeof error.constraint !== 'string'
  ) {
    return error
  }

  const violation =
    USER_UNIQUE_CONSTRAINTS[error.constraint as keyof typeof USER_UNIQUE_CONSTRAINTS]

  if (!violation || !allowedFields.includes(violation.field)) {
    return error
  }

  return new errors.E_VALIDATION_ERROR(
    [
      {
        field: violation.field,
        rule: 'database.unique',
        message: violation.message,
      },
    ],
    { cause: error }
  )
}
