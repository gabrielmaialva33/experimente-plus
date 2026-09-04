import vine from '@vinejs/vine'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import {
  PERMISSION_CHECK_MAX_ITEMS,
  PERMISSION_MUTATION_MAX_ITEMS,
  POSTGRES_INTEGER_MAX,
} from '#modules/permissions/permission_limits'

const postgresId = (strict = true) =>
  vine.number({ strict }).withoutDecimals().min(1).max(POSTGRES_INTEGER_MAX)

export const listPermissionsValidator = vine.compile(
  vine.object({
    page: vine.number().withoutDecimals().min(1).optional(),
    per_page: vine.number().withoutDecimals().min(1).max(100).optional(),
    resource: vine.enum(Object.values(IPermission.Resources)).optional(),
    action: vine.enum(Object.values(IPermission.Actions)).optional(),
  })
)

export const permissionUserIdParamValidator = vine.compile(
  vine.object({
    id: postgresId(false),
  })
)

/**
 * Validator for creating a permission
 */
export const createPermissionValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().maxLength(500).optional(),
    resource: vine.enum(Object.values(IPermission.Resources)),
    action: vine.enum(Object.values(IPermission.Actions)),
    context: vine.enum(Object.values(IPermission.Contexts)).optional(),
  })
)

/**
 * Validator for syncing role permissions
 */
export const syncRolePermissionsValidator = vine.compile(
  vine.object({
    role_id: postgresId(),
    permission_ids: vine.array(postgresId()).maxLength(PERMISSION_MUTATION_MAX_ITEMS).distinct(),
  })
)

/**
 * Validator for syncing user permissions
 */
export const syncUserPermissionsValidator = vine.compile(
  vine.object({
    user_id: postgresId(),
    permissions: vine
      .array(
        vine.object({
          permission_id: postgresId(),
          granted: vine.boolean({ strict: true }).optional(),
          expires_at: vine.string().trim().maxLength(64).optional().nullable(),
        })
      )
      .maxLength(PERMISSION_MUTATION_MAX_ITEMS)
      .distinct('permission_id'),
  })
)

export const checkUserPermissionsValidator = vine.compile(
  vine.object({
    permissions: vine
      .array(vine.string().trim().minLength(3).maxLength(255))
      .minLength(1)
      .maxLength(PERMISSION_CHECK_MAX_ITEMS)
      .distinct(),
    require_all: vine.boolean({ strict: true }).optional(),
  })
)
