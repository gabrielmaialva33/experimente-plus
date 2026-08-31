import { BaseSchema } from '@adonisjs/lucid/schema'

const permissionDefinitions = [
  { resource: 'benefit_accesses', action: 'create' },
  { resource: 'benefit_accesses', action: 'read' },
  { resource: 'benefit_accesses', action: 'list' },
  { resource: 'benefit_accesses', action: 'revoke' },
] as const

const permissionNames = permissionDefinitions.map(({ resource, action }) => `${resource}.${action}`)
const moderatorPermissionNames = new Set(['benefit_accesses.read', 'benefit_accesses.list'])

export default class extends BaseSchema {
  async up() {
    await this.db.transaction(async (trx) => {
      const now = new Date()

      await trx
        .table('permissions')
        .insert(
          permissionDefinitions.map(({ resource, action }) => ({
            name: `${resource}.${action}`,
            resource,
            action,
            context: 'any',
            description: `${action.charAt(0).toUpperCase()}${action.slice(1)} ${resource}`,
            created_at: now,
            updated_at: now,
          }))
        )
        .onConflict('name')
        .merge(['resource', 'action', 'context', 'description', 'updated_at'])

      const permissions = await trx
        .from('permissions')
        .whereIn('name', permissionNames)
        .select(['id', 'name'])
      const roles = await trx
        .from('roles')
        .whereIn('slug', ['root', 'admin', 'moderator'])
        .select(['id', 'slug'])

      const pivotRows = roles.flatMap((role) =>
        permissions
          .filter((permission) => {
            if (role.slug === 'root' || role.slug === 'admin') return true
            return moderatorPermissionNames.has(permission.name)
          })
          .map((permission) => ({
            role_id: role.id,
            permission_id: permission.id,
            created_at: now,
            updated_at: now,
          }))
      )

      if (pivotRows.length > 0) {
        await trx
          .table('role_permissions')
          .insert(pivotRows)
          .onConflict(['role_id', 'permission_id'])
          .ignore()
      }
    })
  }

  async down() {
    await this.db.transaction(async (trx) => {
      const permissionRows = await trx
        .from('permissions')
        .whereIn('name', permissionNames)
        .select('id')
      const permissionIds = permissionRows.map((permission) => permission.id)

      if (permissionIds.length > 0) {
        await trx.from('role_permissions').whereIn('permission_id', permissionIds).delete()
        await trx.from('user_permissions').whereIn('permission_id', permissionIds).delete()
      }

      await trx.from('permissions').whereIn('name', permissionNames).delete()
    })
  }
}
