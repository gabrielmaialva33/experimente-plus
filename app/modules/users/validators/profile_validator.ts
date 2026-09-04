import vine from '@vinejs/vine'
import { USERNAME_PATTERN } from '#modules/users/utils/user_identity'

function clearBlankOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length === 0 ? null : value
}

/**
 * Canonical self-service profile boundary shared by the API and Inertia form.
 * Vine strips every field not declared here from the validated payload.
 */
export const updateProfileValidator = vine.withMetaData<{ userId: number }>().compile(
  vine.object({
    full_name: vine
      .string()
      .trim()
      .minLength(1)
      .maxLength(255)
      .optional()
      .requiredWhen((field) => Object.hasOwn(field.data, 'full_name')),
    username: vine
      .string()
      .parse(clearBlankOptionalString)
      .trim()
      .toLowerCase()
      .minLength(3)
      .maxLength(80)
      .regex(USERNAME_PATTERN)
      .unique(async (db, value, field) => {
        const user = await db
          .from('users')
          .whereNot('id', field.meta.userId)
          .where('username', value)
          .first()
        return !user
      })
      .nullable()
      .optional(),
  })
)
