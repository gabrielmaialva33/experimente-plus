import vine from '@vinejs/vine'
import { POSTGRES_ROLE_INTEGER_MAX, ROLE_ASSIGNMENT_MAX_ITEMS } from '#modules/roles/role_limits'
import {
  ADMINISTRATIVE_LIST_MAX_PAGE_SIZE,
  rejectUnknownQueryFields,
  strictPositiveQueryInteger,
} from '#shared/utils/administrative_list_query'

export const ROLE_LIST_SORT_FIELDS = [
  'id',
  'name',
  'description',
  'slug',
  'created_at',
  'updated_at',
] as const

const ROLE_LIST_QUERY_FIELDS = ['page', 'per_page', 'sort_by', 'order'] as const

function databaseId() {
  return vine.number({ strict: true }).withoutDecimals().min(1).max(POSTGRES_ROLE_INTEGER_MAX)
}

export const attachRoleValidator = vine.compile(
  vine.object({
    user_id: databaseId(),
    role_ids: vine.array(databaseId()).minLength(1).maxLength(ROLE_ASSIGNMENT_MAX_ITEMS).distinct(),
  })
)

export const listRolesValidator = vine.compile(
  vine
    .object({
      page: strictPositiveQueryInteger(POSTGRES_ROLE_INTEGER_MAX).optional(),
      per_page: strictPositiveQueryInteger(ADMINISTRATIVE_LIST_MAX_PAGE_SIZE).optional(),
      sort_by: vine.enum(ROLE_LIST_SORT_FIELDS).optional(),
      order: vine.enum(['asc', 'desc'] as const).optional(),
    })
    .allowUnknownProperties()
    .use(rejectUnknownQueryFields(ROLE_LIST_QUERY_FIELDS))
)
