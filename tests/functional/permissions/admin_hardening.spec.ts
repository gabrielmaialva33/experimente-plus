import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import redis from '@adonisjs/redis/services/main'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import Permission from '#modules/permissions/models/permission'
import { canonicalPermissionName } from '#modules/permissions/permission_name'
import PermissionService from '#modules/permissions/services/permission_service'
import SyncRolePermissionsService from '#modules/permissions/services/sync_role_permissions_service'
import SyncUserPermissionsService from '#modules/permissions/services/sync_user_permissions_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import User from '#modules/users/models/user'

test.group('Permission administration hardening', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await redis.flushdb()
  })

  async function createUserWithRole(label: string, role: Role): Promise<User> {
    const identity = label.toLowerCase().replaceAll('_', '-')
    const user = await User.create({
      full_name: label,
      email: `${identity}@example.com`,
      username: identity,
      password: 'password123',
    })
    await user.related('roles').attach([role.id])
    return user
  }

  test('rechecks a revoked mutation permission inside the transaction', async ({
    client,
    assert,
  }) => {
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const moderatorRole = await Role.findByOrFail('slug', IRole.Slugs.MODERATOR)
    const actor = await createUserWithRole('revoked_permission_admin', adminRole)
    const updatePermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.PERMISSIONS}.${IPermission.Actions.UPDATE}`
    )
    const candidate = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.USERS}.${IPermission.Actions.READ}`
    )
    const permissionService = await app.container.make(PermissionService)

    await adminRole.related('permissions').attach([updatePermission.id])
    await permissionService.getEffectivePermissions(actor.id)
    await adminRole.related('permissions').detach([updatePermission.id])

    const response = await client
      .put('/api/v1/admin/roles/permissions/attach')
      .loginAs(actor)
      .json({ role_id: moderatorRole.id, permission_ids: [candidate.id] })

    response.assertStatus(403)
    const pivot = await db
      .from('role_permissions')
      .where('role_id', moderatorRole.id)
      .where('permission_id', candidate.id)
      .first()
    assert.isNull(pivot)
  })

  test('never changes the root role, including when the actor is root', async ({
    client,
    assert,
  }) => {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const actor = await createUserWithRole('root_role_guard', rootRole)
    const updatePermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.PERMISSIONS}.${IPermission.Actions.UPDATE}`
    )
    const before = await db
      .from('role_permissions')
      .where('role_id', rootRole.id)
      .count('* as total')

    const response = await client
      .put('/api/v1/admin/roles/permissions/sync')
      .loginAs(actor)
      .json({ role_id: rootRole.id, permission_ids: [updatePermission.id] })

    response.assertStatus(403)
    const after = await db
      .from('role_permissions')
      .where('role_id', rootRole.id)
      .count('* as total')
    assert.equal(Number(after[0].total), Number(before[0].total))
  })

  test('fails closed for non-canonical roles and inactive actors', async ({ client, assert }) => {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const actor = await createUserWithRole('permission_fail_closed_root', rootRole)
    const customRole = await Role.create({
      name: 'Legacy Custom Role',
      slug: 'legacy-custom' as IRole.Slugs,
      description: 'Non-canonical role retained only to verify fail-closed behavior',
    })
    const candidate = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.USERS}.${IPermission.Actions.READ}`
    )

    const customRoleResponse = await client
      .put('/api/v1/admin/roles/permissions/attach')
      .loginAs(actor)
      .json({ role_id: customRole.id, permission_ids: [candidate.id] })
    customRoleResponse.assertStatus(403)

    actor.is_deleted = true
    await actor.save()
    const service = await app.container.make(SyncRolePermissionsService)
    await assert.rejects(
      () =>
        service.attachPermissions({
          actorUserId: actor.id,
          roleId: customRole.id,
          permissionIds: [candidate.id],
        }),
      'The acting user is no longer active'
    )

    const rows = await db.from('role_permissions').where('role_id', customRole.id)
    assert.lengthOf(rows, 0)
  })

  test('rejects an actor demoted below admin even when a direct mutation grant remains', async ({
    assert,
  }) => {
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const moderatorRole = await Role.findByOrFail('slug', IRole.Slugs.MODERATOR)
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    const guestRole = await Role.findByOrFail('slug', IRole.Slugs.GUEST)
    const actor = await createUserWithRole('demoted_permission_admin', adminRole)
    const target = await createUserWithRole('demoted_permission_target', userRole)
    const secondActor = await createUserWithRole('demoted_permission_admin_two', adminRole)
    const secondTarget = await createUserWithRole('demoted_permission_guest_target', guestRole)
    const updatePermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.PERMISSIONS}.${IPermission.Actions.UPDATE}`
    )
    const candidate = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.USERS}.${IPermission.Actions.READ}`
    )
    await actor.related('permissions').attach({
      [updatePermission.id]: { granted: true, expires_at: null },
    })
    await secondActor.related('permissions').attach({
      [updatePermission.id]: { granted: true, expires_at: null },
    })

    await actor.related('roles').sync([moderatorRole.id])
    await secondActor.related('roles').sync([userRole.id])

    const service = await app.container.make(SyncUserPermissionsService)
    for (const [demotedActor, lowerTarget] of [
      [actor, target],
      [secondActor, secondTarget],
    ] as const) {
      await assert.rejects(
        () =>
          service.handle({
            actorUserId: demotedActor.id,
            userId: lowerTarget.id,
            permissions: [{ permission_id: candidate.id, granted: true }],
          }),
        'The acting user is no longer a platform administrator'
      )
    }

    const pivots = await db
      .from('user_permissions')
      .whereIn('user_id', [target.id, secondTarget.id])
      .where('permission_id', candidate.id)
    assert.lengthOf(pivots, 0)
  })

  test('denies direct permission mutations for self, peers and root targets', async ({
    client,
    assert,
  }) => {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const updatePermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.PERMISSIONS}.${IPermission.Actions.UPDATE}`
    )
    const candidate = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.USERS}.${IPermission.Actions.READ}`
    )
    await adminRole.related('permissions').attach([updatePermission.id])

    const admin = await createUserWithRole('permission_admin', adminRole)
    const peer = await createUserWithRole('permission_admin_peer', adminRole)
    const rootTarget = await createUserWithRole('permission_root_target', rootRole)

    for (const target of [admin, peer, rootTarget]) {
      const response = await client
        .put('/api/v1/admin/users/permissions/sync')
        .loginAs(admin)
        .json({
          user_id: target.id,
          permissions: [{ permission_id: candidate.id, granted: true }],
        })
      response.assertStatus(403)
    }

    const rows = await db
      .from('user_permissions')
      .whereIn('user_id', [admin.id, peer.id, rootTarget.id])
      .where('permission_id', candidate.id)
    assert.lengthOf(rows, 0)
  })

  test('allows root to change a lower user and returns 404 for missing targets', async ({
    client,
    assert,
  }) => {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    const actor = await createUserWithRole('lower_user_root', rootRole)
    const target = await createUserWithRole('lower_permission_user', userRole)
    const candidate = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.USERS}.${IPermission.Actions.READ}`
    )

    const allowed = await client
      .put('/api/v1/admin/users/permissions/sync')
      .loginAs(actor)
      .json({
        user_id: target.id,
        permissions: [{ permission_id: candidate.id, granted: true }],
      })
    allowed.assertStatus(200)
    assert.isDefined(
      await db
        .from('user_permissions')
        .where('user_id', target.id)
        .where('permission_id', candidate.id)
        .first()
    )

    const missingUser = await client
      .put('/api/v1/admin/users/permissions/sync')
      .loginAs(actor)
      .json({ user_id: 2_147_483_647, permissions: [] })
    missingUser.assertStatus(404)

    const missingRole = await client
      .put('/api/v1/admin/roles/permissions/sync')
      .loginAs(actor)
      .json({ role_id: 2_147_483_647, permission_ids: [] })
    missingRole.assertStatus(404)
  })

  test('accepts the legacy name field but persists the canonical tuple-derived name', async ({
    client,
    assert,
  }) => {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const actor = await createUserWithRole('canonical_permission_name_root', rootRole)

    const response = await client.post('/api/v1/admin/permissions').loginAs(actor).json({
      name: 'legacy.permission.alias',
      resource: IPermission.Resources.REPORTS,
      action: IPermission.Actions.IMPORT,
      context: IPermission.Contexts.TEAM,
    })

    response.assertStatus(201)
    response.assertBodyContains({
      name: 'reports.import.team',
      resource: IPermission.Resources.REPORTS,
      action: IPermission.Actions.IMPORT,
      context: IPermission.Contexts.TEAM,
    })
    assert.isNotNull(await Permission.findBy('name', 'reports.import.team'))
    assert.isNull(await Permission.findBy('name', 'legacy.permission.alias'))
  })

  test('maps only a canonical permission-name collision to validation', async ({
    client,
    assert,
  }) => {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const actor = await createUserWithRole('permission_name_conflict_root', rootRole)
    const canonicalName = canonicalPermissionName(
      IPermission.Resources.REPORTS,
      IPermission.Actions.IMPORT
    )
    await Permission.create({
      name: canonicalName,
      description: 'Legacy row with a mismatched tuple',
      resource: IPermission.Resources.REPORTS,
      action: IPermission.Actions.EXPORT,
      context: IPermission.Contexts.OWN,
    })

    const response = await client.post('/api/v1/admin/permissions').loginAs(actor).json({
      resource: IPermission.Resources.REPORTS,
      action: IPermission.Actions.IMPORT,
    })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'name',
          rule: 'database.unique',
          message: 'The canonical permission name is already assigned to another permission tuple',
        },
      ],
    })
    assert.isNull(
      await Permission.query()
        .where('resource', IPermission.Resources.REPORTS)
        .where('action', IPermission.Actions.IMPORT)
        .where('context', IPermission.Contexts.ANY)
        .first()
    )
  })

  test('uses only the declared transport source and enforces collection bounds', async ({
    client,
  }) => {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const moderatorRole = await Role.findByOrFail('slug', IRole.Slugs.MODERATOR)
    const actor = await createUserWithRole('permission_boundary_root', rootRole)
    const candidate = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.USERS}.${IPermission.Actions.READ}`
    )

    const queryOnlyMutation = await client
      .put('/api/v1/admin/roles/permissions/attach')
      .loginAs(actor)
      .qs({ role_id: moderatorRole.id, permission_ids: [candidate.id] })
      .json({})
    queryOnlyMutation.assertStatus(422)

    const queryOnlyCreation = await client
      .post('/api/v1/admin/permissions')
      .loginAs(actor)
      .qs({ resource: IPermission.Resources.REPORTS, action: IPermission.Actions.IMPORT })
      .json({})
    queryOnlyCreation.assertStatus(422)

    const duplicateIds = await client
      .put('/api/v1/admin/roles/permissions/attach')
      .loginAs(actor)
      .json({ role_id: moderatorRole.id, permission_ids: [candidate.id, candidate.id] })
    duplicateIds.assertStatus(422)

    const oversized = await client
      .put('/api/v1/admin/roles/permissions/attach')
      .loginAs(actor)
      .json({
        role_id: moderatorRole.id,
        permission_ids: Array.from({ length: 257 }, (_, index) => index + 1),
      })
    oversized.assertStatus(422)

    const stringId = await client
      .put('/api/v1/admin/roles/permissions/attach')
      .loginAs(actor)
      .json({ role_id: String(moderatorRole.id), permission_ids: [candidate.id] })
    stringId.assertStatus(422)

    const oversizedPage = await client
      .get('/api/v1/admin/permissions')
      .loginAs(actor)
      .qs({ per_page: 101 })
    oversizedPage.assertStatus(422)

    const queryOnlyCheck = await client
      .post(`/api/v1/admin/users/${actor.id}/permissions/check`)
      .loginAs(actor)
      .qs({ permissions: [candidate.name] })
      .json({})
    queryOnlyCheck.assertStatus(422)

    const oversizedParam = await client
      .get('/api/v1/admin/users/2147483648/permissions')
      .loginAs(actor)
    oversizedParam.assertStatus(422)
  })
})
