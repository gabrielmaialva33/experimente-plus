import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import Permission from '#modules/permissions/models/permission'
import FreshPlatformPermissionService from '#modules/permissions/services/fresh_platform_permission_service'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import SyncRolesService from '#modules/roles/services/sync_roles_service'
import User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'
import ActiveRootGuardService from '#modules/users/services/active_root_guard_service'
import UserAdministrationPolicyService from '#modules/users/services/user_administration_policy_service'

type Deferred = {
  promise: Promise<void>
  resolve: () => void
}

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function createUser(label: string, role: Role): Promise<User> {
  const suffix = randomUUID()
  const user = await User.create({
    full_name: label,
    email: `${label}-${suffix}@example.com`,
    username: `${label}-${suffix}`,
    password: 'password123',
  })
  await user.related('roles').attach([role.id])
  return user
}

function createService(usersRepository: UsersRepository): SyncRolesService {
  const freshPermission = new FreshPlatformPermissionService()
  return new SyncRolesService(
    usersRepository,
    new PermissionCacheService(usersRepository),
    new UserAdministrationPolicyService(new ActiveRootGuardService()),
    freshPermission
  )
}

test.group('Role assignment serialization', () => {
  test('observes a concurrent roles.assign revocation before attaching a role', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const guestRole = await Role.findByOrFail('slug', IRole.Slugs.GUEST)
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    const assignPermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.ROLES}.${IPermission.Actions.ASSIGN}`
    )
    const originalGrant = await db
      .from('role_permissions')
      .where('role_id', adminRole.id)
      .where('permission_id', assignPermission.id)
      .first()
    await adminRole.related('permissions').sync([assignPermission.id], false)
    const actor = await createUser('role-revocation-actor', adminRole)
    const target = await createUser('role-revocation-target', guestRole)
    const usersRepository = new UsersRepository()
    const service = createService(usersRepository)
    const revocationLocked = deferred()
    const releaseRevocation = deferred()
    const revocation = db.transaction(async (client) => {
      await Role.query({ client }).where('id', adminRole.id).forUpdate().firstOrFail()
      revocationLocked.resolve()
      await releaseRevocation.promise
      await client
        .from('role_permissions')
        .where('role_id', adminRole.id)
        .where('permission_id', assignPermission.id)
        .delete()
    })

    cleanup(async () => {
      releaseRevocation.resolve()
      await revocation.catch(() => {})
      await db
        .from('role_permissions')
        .where('role_id', adminRole.id)
        .where('permission_id', assignPermission.id)
        .delete()
      if (originalGrant) {
        await db.table('role_permissions').insert(originalGrant)
      }
      await db.from('users').whereIn('id', [actor.id, target.id]).delete()
      await new PermissionCacheService(usersRepository).clearAllCache()
    })
    await revocationLocked.promise

    const mutationRequestedLocks = deferred()
    const lockActiveUsers = usersRepository.lockActiveByIds.bind(usersRepository)
    usersRepository.lockActiveByIds = async (userIds, client) => {
      mutationRequestedLocks.resolve()
      return lockActiveUsers(userIds, client)
    }
    let settled = false
    const assignment = service.run({
      actorUserId: actor.id,
      userId: target.id,
      roleIds: [userRole.id],
    })
    void assignment.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      }
    )
    await mutationRequestedLocks.promise
    await new Promise<void>((resolve) => setImmediate(resolve))
    assert.isFalse(settled)

    releaseRevocation.resolve()
    await revocation
    await assert.rejects(
      () => assignment,
      'The acting user no longer has permission to perform this action'
    )

    const assigned = await db
      .from('user_roles')
      .where('user_id', target.id)
      .where('role_id', userRole.id)
      .first()
    assert.isNull(assigned)
  })

  test('observes a concurrent Admin to Moderator demotion despite a direct grant', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const moderatorRole = await Role.findByOrFail('slug', IRole.Slugs.MODERATOR)
    const guestRole = await Role.findByOrFail('slug', IRole.Slugs.GUEST)
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    const assignPermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.ROLES}.${IPermission.Actions.ASSIGN}`
    )
    const actor = await createUser('role-demotion-actor', adminRole)
    const target = await createUser('role-demotion-target', guestRole)
    await actor.related('permissions').attach({
      [assignPermission.id]: { granted: true, expires_at: null },
    })
    const usersRepository = new UsersRepository()
    const service = createService(usersRepository)
    const demotionLocked = deferred()
    const releaseDemotion = deferred()
    const demotion = db.transaction(async (client) => {
      await usersRepository.findActiveByIdForUpdate(actor.id, client)
      demotionLocked.resolve()
      await releaseDemotion.promise
      await client
        .from('user_roles')
        .where('user_id', actor.id)
        .where('role_id', adminRole.id)
        .update({ role_id: moderatorRole.id, updated_at: new Date() })
    })

    cleanup(async () => {
      releaseDemotion.resolve()
      await demotion.catch(() => {})
      await db.from('users').whereIn('id', [actor.id, target.id]).delete()
      await new PermissionCacheService(usersRepository).clearAllCache()
    })
    await demotionLocked.promise

    const mutationRequestedLocks = deferred()
    const lockActiveUsers = usersRepository.lockActiveByIds.bind(usersRepository)
    usersRepository.lockActiveByIds = async (userIds, client) => {
      mutationRequestedLocks.resolve()
      return lockActiveUsers(userIds, client)
    }
    let settled = false
    const assignment = service.run({
      actorUserId: actor.id,
      userId: target.id,
      roleIds: [userRole.id],
    })
    void assignment.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      }
    )
    await mutationRequestedLocks.promise
    await new Promise<void>((resolve) => setImmediate(resolve))
    assert.isFalse(settled)

    releaseDemotion.resolve()
    await demotion
    await assert.rejects(() => assignment, 'The acting user is no longer a platform administrator')

    const assigned = await db
      .from('user_roles')
      .where('user_id', target.id)
      .where('role_id', userRole.id)
      .first()
    assert.isNull(assigned)
  })
})
