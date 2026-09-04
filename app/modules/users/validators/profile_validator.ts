import vine from '@vinejs/vine'

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
      .trim()
      .minLength(3)
      .maxLength(80)
      .unique(async (db, value, field) => {
        const user = await db
          .from('users')
          .whereNot('id', field.meta.userId)
          .where('username', value)
          .first()
        return !user
      })
      .optional()
      .requiredWhen((field) => Object.hasOwn(field.data, 'username')),
  })
)
