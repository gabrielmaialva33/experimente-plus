import { BaseSchema } from '@adonisjs/lucid/schema'

const defaultPermissionActions: Record<string, readonly string[]> = {
  users: ['create', 'read', 'update', 'delete', 'list', 'export'],
  roles: ['create', 'read', 'update', 'delete', 'list', 'assign', 'revoke'],
  permissions: ['create', 'read', 'update', 'delete', 'list', 'assign', 'revoke'],
  files: ['create', 'read', 'delete', 'list'],
  media: ['create', 'read', 'update', 'delete', 'list', 'approve', 'reject'],
  analytics: ['read', 'list'],
  pilot_feedback: ['create', 'read', 'list', 'update'],
  tenants: ['create', 'read', 'update', 'delete', 'list'],
  regions: ['create', 'read', 'update', 'delete', 'list'],
  cities: ['create', 'read', 'update', 'delete', 'list'],
  category_families: ['create', 'read', 'update', 'delete', 'list'],
  categories: ['create', 'read', 'update', 'delete', 'list'],
  category_attributes: ['create', 'read', 'update', 'delete', 'list'],
  organizations: [
    'create',
    'read',
    'update',
    'list',
    'submit',
    'approve',
    'reject',
    'request_changes',
    'suspend',
    'restore',
    'archive',
  ],
  organization_members: ['read', 'update', 'delete', 'list'],
  organization_invitations: ['create', 'read', 'list', 'resend', 'revoke', 'accept'],
  organization_claims: ['create', 'read', 'list', 'approve', 'reject'],
  establishments: [
    'create',
    'read',
    'update',
    'list',
    'submit',
    'approve',
    'reject',
    'request_changes',
    'suspend',
    'restore',
    'archive',
  ],
  settings: ['read', 'update'],
  reports: ['read', 'create', 'export'],
  audit: ['read', 'list', 'export'],
  dashboard: ['read'],
}

const globalPermissions = Object.entries(defaultPermissionActions).flatMap(([resource, actions]) =>
  actions.map((action) => ({
    name: `${resource}.${action}`,
    resource,
    action,
    context: 'any',
    description: `${action.charAt(0).toUpperCase()}${action.slice(1)} ${resource}`,
  }))
)

const contextualPermissions = [
  {
    name: 'files.delete.own',
    resource: 'files',
    action: 'delete',
    context: 'own',
    description: 'Delete own files',
  },
]

const defaultPermissions = [...globalPermissions, ...contextualPermissions]
const defaultPermissionNames = defaultPermissions.map((permission) => permission.name)

const userPermissionNames = new Set([
  'dashboard.read',
  'files.create',
  'files.read',
  'files.list',
  'files.delete.own',
  'tenants.create',
  'tenants.read',
  'tenants.list',
  'organizations.create',
  'organizations.read',
  'organizations.update',
  'organizations.list',
  'organizations.submit',
  'organizations.archive',
  'organization_members.read',
  'organization_members.update',
  'organization_members.delete',
  'organization_members.list',
  'organization_invitations.create',
  'organization_invitations.read',
  'organization_invitations.list',
  'organization_invitations.resend',
  'organization_invitations.revoke',
  'organization_invitations.accept',
  'organization_claims.create',
  'organization_claims.read',
  'organization_claims.list',
  'establishments.create',
  'establishments.read',
  'establishments.update',
  'establishments.list',
  'establishments.submit',
  'establishments.archive',
  'media.create',
  'media.read',
  'media.update',
  'media.delete',
  'media.list',
  'analytics.read',
  'pilot_feedback.create',
])

const moderatorPermissionNames = new Set([
  'organizations.read',
  'organizations.list',
  'organizations.approve',
  'organizations.reject',
  'organizations.request_changes',
  'organizations.suspend',
  'organizations.restore',
  'organization_claims.read',
  'organization_claims.list',
  'organization_claims.approve',
  'organization_claims.reject',
  'establishments.read',
  'establishments.list',
  'establishments.approve',
  'establishments.reject',
  'establishments.request_changes',
  'media.read',
  'media.list',
  'media.approve',
  'media.reject',
])

export default class extends BaseSchema {
  async up() {
    await this.db.transaction(async (trx) => {
      const now = new Date()

      await trx.table('permissions').multiInsert(
        defaultPermissions.map((permission) => ({
          ...permission,
          created_at: now,
          updated_at: now,
        }))
      )

      const permissions = await trx
        .from('permissions')
        .whereIn('name', defaultPermissionNames)
        .select(['id', 'name', 'resource', 'action'])
      const roles = await trx
        .from('roles')
        .whereIn('slug', ['root', 'admin', 'moderator', 'user'])
        .select(['id', 'slug'])

      const roleIds = new Map(roles.map((role) => [role.slug, role.id]))
      const pivotRows: Array<{
        role_id: number
        permission_id: number
        created_at: Date
        updated_at: Date
      }> = []

      const rootRoleId = roleIds.get('root')
      const adminRoleId = roleIds.get('admin')
      const moderatorRoleId = roleIds.get('moderator')
      const userRoleId = roleIds.get('user')

      for (const permission of permissions) {
        if (rootRoleId) {
          pivotRows.push({
            role_id: rootRoleId,
            permission_id: permission.id,
            created_at: now,
            updated_at: now,
          })
        }

        const adminCanUsePermission =
          permission.resource !== 'permissions' || ['read', 'list'].includes(permission.action)
        if (adminRoleId && adminCanUsePermission) {
          pivotRows.push({
            role_id: adminRoleId,
            permission_id: permission.id,
            created_at: now,
            updated_at: now,
          })
        }

        if (moderatorRoleId && moderatorPermissionNames.has(permission.name)) {
          pivotRows.push({
            role_id: moderatorRoleId,
            permission_id: permission.id,
            created_at: now,
            updated_at: now,
          })
        }

        if (userRoleId && userPermissionNames.has(permission.name)) {
          pivotRows.push({
            role_id: userRoleId,
            permission_id: permission.id,
            created_at: now,
            updated_at: now,
          })
        }
      }

      if (pivotRows.length > 0) {
        await trx.table('role_permissions').multiInsert(pivotRows)
      }
    })
  }

  async down() {
    await this.db.from('permissions').whereIn('name', defaultPermissionNames).delete()
  }
}
