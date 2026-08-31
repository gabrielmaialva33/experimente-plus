import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import Permission from '#modules/permissions/models/permission'
import { getDefaultPermissionNames } from '#modules/permissions/services/create_default_permissions_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import User from '#modules/users/models/user'

const userPermissionNames = [
  'analytics.read',
  'pilot_feedback.create',
  'dashboard.read',
  'files.create',
  'files.delete.own',
  'files.list',
  'files.read',
  'tenants.create',
  'tenants.list',
  'tenants.read',
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
  'benefit_editions.read',
  'benefit_editions.list',
  'benefit_offers.create',
  'benefit_offers.read',
  'benefit_offers.update',
  'benefit_offers.list',
  'benefit_offers.archive',
  'media.create',
  'media.read',
  'media.update',
  'media.delete',
  'media.list',
]

const moderatorPermissionNames = [
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
  'benefit_editions.read',
  'benefit_editions.list',
  'benefit_offers.read',
  'benefit_offers.list',
  'benefit_accesses.read',
  'benefit_accesses.list',
  'media.read',
  'media.list',
  'media.approve',
  'media.reject',
]

test.group('Database bootstrap', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should keep migration defaults aligned with the runtime permission catalog', async ({
    assert,
  }) => {
    const permissions = await Permission.query().orderBy('name', 'asc')
    const actualPermissionNames = permissions.map((permission) => permission.name)
    const expectedPermissionNames = [...getDefaultPermissionNames()].sort()

    assert.deepEqual(actualPermissionNames, expectedPermissionNames)

    const root = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    await root.load('permissions')
    assert.sameMembers(
      root.permissions.map((permission) => permission.name),
      expectedPermissionNames
    )

    const moderator = await Role.findByOrFail('slug', IRole.Slugs.MODERATOR)
    await moderator.load('permissions')
    assert.sameMembers(
      moderator.permissions.map((permission) => permission.name),
      moderatorPermissionNames
    )

    const user = await Role.findByOrFail('slug', IRole.Slugs.USER)
    await user.load('permissions')
    assert.sameMembers(
      user.permissions.map((permission) => permission.name),
      userPermissionNames
    )
  })

  test('should enforce canonical RBAC uniqueness constraints', async ({ assert }) => {
    const user = await User.create({
      full_name: 'Constraint User',
      email: 'constraint-user@example.com',
      username: 'constraint-user',
      password: 'password123',
    })
    const role = await Role.findByOrFail('slug', IRole.Slugs.USER)
    await user.related('roles').attach([role.id])

    await assert.rejects(() =>
      db.transaction(async (client) => {
        await client.table('user_roles').insert({
          user_id: user.id,
          role_id: role.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
      })
    )

    const fileDeletePermissions = await Permission.query()
      .where('resource', 'files')
      .where('action', 'delete')
    assert.sameMembers(
      fileDeletePermissions.map((permission) => permission.context),
      ['any', 'own']
    )

    await assert.rejects(() =>
      db.transaction(async (client) => {
        await client.table('permissions').insert({
          name: 'files.delete.duplicate-own',
          description: 'Duplicate contextual permission',
          resource: 'files',
          action: 'delete',
          context: 'own',
          created_at: new Date(),
          updated_at: new Date(),
        })
      })
    )
  })
})
