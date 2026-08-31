import { BaseSchema } from '@adonisjs/lucid/schema'

const permissionDefinitions = [
  { resource: 'benefit_editions', action: 'create' },
  { resource: 'benefit_editions', action: 'read' },
  { resource: 'benefit_editions', action: 'update' },
  { resource: 'benefit_editions', action: 'list' },
  { resource: 'benefit_editions', action: 'archive' },
  { resource: 'benefit_offers', action: 'create' },
  { resource: 'benefit_offers', action: 'read' },
  { resource: 'benefit_offers', action: 'update' },
  { resource: 'benefit_offers', action: 'list' },
  { resource: 'benefit_offers', action: 'archive' },
] as const

const permissionNames = permissionDefinitions.map(({ resource, action }) => `${resource}.${action}`)

const moderatorPermissionNames = new Set([
  'benefit_editions.read',
  'benefit_editions.list',
  'benefit_offers.read',
  'benefit_offers.list',
])

const userPermissionNames = new Set([
  'benefit_editions.read',
  'benefit_editions.list',
  'benefit_offers.create',
  'benefit_offers.read',
  'benefit_offers.update',
  'benefit_offers.list',
  'benefit_offers.archive',
])

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
        .whereIn('slug', ['root', 'admin', 'moderator', 'user'])
        .select(['id', 'slug'])

      const pivotRows = roles.flatMap((role) =>
        permissions
          .filter((permission) => {
            if (role.slug === 'root' || role.slug === 'admin') return true
            if (role.slug === 'moderator') return moderatorPermissionNames.has(permission.name)
            if (role.slug === 'user') return userPermissionNames.has(permission.name)
            return false
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
