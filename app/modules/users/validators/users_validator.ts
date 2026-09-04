import vine from '@vinejs/vine'
import { USERNAME_PATTERN } from '#modules/users/utils/user_identity'
import {
  ADMINISTRATIVE_LIST_MAX_PAGE_SIZE,
  rejectUnknownQueryFields,
  strictPositiveQueryInteger,
} from '#shared/utils/administrative_list_query'

const POSTGRES_INTEGER_MAX = 2_147_483_647

export const USER_LIST_SORT_FIELDS = [
  'id',
  'full_name',
  'email',
  'username',
  'created_at',
  'updated_at',
] as const

const USER_LIST_QUERY_FIELDS = ['page', 'per_page', 'sort_by', 'order', 'search'] as const

function omitBlankOptionalString(value: unknown) {
  if (value === null) {
    return undefined
  }

  return typeof value === 'string' && value.trim().length === 0 ? undefined : value
}

function userCreationFields() {
  return {
    full_name: vine.string().trim().maxLength(255),
    email: vine
      .string()
      .trim()
      .toLowerCase()
      .maxLength(254)
      .email()
      .unique(async (db, value) => {
        const user = await db.from('users').where('email', value).first()
        return !user
      }),
    username: vine
      .string()
      .parse(omitBlankOptionalString)
      .trim()
      .toLowerCase()
      .minLength(3)
      .maxLength(80)
      .regex(USERNAME_PATTERN)
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
    full_name: vine.string().trim().maxLength(255).optional(),
    password: vine
      .string()
      .minLength(8)
      .confirmed({ confirmationField: 'password_confirmation' })
      .optional(),
  })
)

export const signInValidator = vine.compile(
  vine.object({
    uid: vine.string().trim().toLowerCase(),
    password: vine.string(),
  })
)

/** Administrative listings accept one canonical, query-string-only contract. */
export const listUsersValidator = vine.compile(
  vine
    .object({
      page: strictPositiveQueryInteger(POSTGRES_INTEGER_MAX).optional(),
      per_page: strictPositiveQueryInteger(ADMINISTRATIVE_LIST_MAX_PAGE_SIZE).optional(),
      sort_by: vine.enum(USER_LIST_SORT_FIELDS).optional(),
      order: vine.enum(['asc', 'desc'] as const).optional(),
      search: vine.string().trim().minLength(1).maxLength(100).optional(),
    })
    .allowUnknownProperties()
    .use(rejectUnknownQueryFields(USER_LIST_QUERY_FIELDS))
)

/** Route params arrive as strings, so conversion is intentional at this boundary. */
export const userIdParamValidator = vine.compile(
  vine.object({
    id: vine.number().withoutDecimals().min(1).max(POSTGRES_INTEGER_MAX),
  })
)
