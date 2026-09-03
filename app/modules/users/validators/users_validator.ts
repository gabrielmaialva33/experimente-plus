import vine from '@vinejs/vine'

function userCreationFields() {
  return {
    full_name: vine.string().trim(),
    email: vine
      .string()
      .email()
      .trim()
      .unique(async (db, value) => {
        const user = await db.from('users').where('email', value).first()
        return !user
      }),
    username: vine
      .string()
      .trim()
      .minLength(3)
      .unique(async (db, value) => {
        const user = await db.from('users').where('username', value).first()
        return !user
      })
      .optional(),
    password: vine.string().minLength(8).confirmed({ confirmationField: 'password_confirmation' }),
  }
}

/** Administrative user creation does not represent a public terms acceptance. */
export const createUserValidator = vine.compile(vine.object(userCreationFields()))

/**
 * Public registration must explicitly accept the current legal documents. The
 * acceptance is validated at the boundary and intentionally not persisted as
 * evidence until the product defines a versioned consent/audit contract.
 */
export const publicRegistrationValidator = vine.compile(
  vine.object({
    ...userCreationFields(),
    terms_accepted: vine.accepted(),
  })
)

export const editUserValidator = vine.withMetaData<{ userId: number }>().compile(
  vine.object({
    full_name: vine.string().trim().optional(),
    password: vine
      .string()
      .minLength(8)
      .confirmed({ confirmationField: 'password_confirmation' })
      .optional(),
  })
)

export const signInValidator = vine.compile(
  vine.object({
    uid: vine.string().trim(),
    password: vine.string(),
  })
)
