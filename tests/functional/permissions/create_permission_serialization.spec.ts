import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import Permission from '#modules/permissions/models/permission'
import CreatePermissionService from '#modules/permissions/services/create_permission_service'
import FreshPlatformPermissionService from '#modules/permissions/services/fresh_platform_permission_service'
import PermissionAdministrationPolicyService from '#modules/permissions/services/permission_administration_policy_service'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

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

async function createAdmin(label: string, role: Role): Promise<User> {
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

function createService(usersRepository: UsersRepository): CreatePermissionService {
  const freshPermission = new FreshPlatformPermissionService()
  return new CreatePermissionService(
    new PermissionCacheService(usersRepository),
    new PermissionAdministrationPolicyService(usersRepository, freshPermission)
  )
}

const candidate = {
  resource: IPermission.Resources.REPORTS,
  action: IPermission.Actions.IMPORT,
  context: IPermission.Contexts.ANY,
  description: 'Permission serialization candidate',
}

test.group('Permission creation serialization', () => {
  test('observes a concurrent permissions.create revocation before the upsert', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const createPermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.PERMISSIONS}.${IPermission.Actions.CREATE}`
    )
    const originalGrant = await db
      .from('role_permissions')
      .where('role_id', adminRole.id)
      .where('permission_id', createPermission.id)
      .first()
    await adminRole.related('permissions').sync([createPermission.id], false)
    const actor = await createAdmin('permission-create-revocation', adminRole)
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
        .where('permission_id', createPermission.id)
        .delete()
    })

    cleanup(async () => {
      releaseRevocation.resolve()
      await revocation.catch(() => {})
      if (originalGrant) {
        await adminRole.related('permissions').sync([createPermission.id], false)
      } else {
        await adminRole.related('permissions').detach([createPermission.id])
      }
      await db
        .from('permissions')
        .where('resource', candidate.resource)
        .where('action', candidate.action)
        .where('context', candidate.context)
        .delete()
      await db.from('users').where('id', actor.id).delete()
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
    const creation = service.handle({ actorUserId: actor.id, data: candidate })
    void creation.then(
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
      () => creation,
      'The acting user no longer has permission to perform this action'
    )

    const created = await Permission.query()
      .where('resource', candidate.resource)
      .where('action', candidate.action)
      .where('context', candidate.context)
      .first()
    assert.isNull(created)
  })

  test('observes a concurrent demotion even when permissions.create remains direct', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const moderatorRole = await Role.findByOrFail('slug', IRole.Slugs.MODERATOR)
    const createPermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.PERMISSIONS}.${IPermission.Actions.CREATE}`
    )
    const actor = await createAdmin('permission-create-demotion', adminRole)
    await actor.related('permissions').attach({
      [createPermission.id]: { granted: true, expires_at: null },
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
      await db
        .from('permissions')
        .where('resource', candidate.resource)
        .where('action', candidate.action)
        .where('context', candidate.context)
        .delete()
      await db.from('users').where('id', actor.id).delete()
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
    const creation = service.handle({ actorUserId: actor.id, data: candidate })
    void creation.then(
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
    await assert.rejects(() => creation, 'The acting user is no longer a platform administrator')

    const created = await Permission.query()
      .where('resource', candidate.resource)
      .where('action', candidate.action)
      .where('context', candidate.context)
      .first()
    assert.isNull(created)
  })

  test('fails closed when the actor is missing', async ({ assert }) => {
    const service = createService(new UsersRepository())

    await assert.rejects(
      () => service.handle({ actorUserId: 2_147_483_647, data: candidate }),
      'The acting user is no longer active'
    )
  })

  test('upserts one row when two administrators create the same tuple concurrently', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const createPermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.PERMISSIONS}.${IPermission.Actions.CREATE}`
    )
    const firstActor = await createAdmin('permission-upsert-first', rootRole)
    const secondActor = await createAdmin('permission-upsert-second', adminRole)
    await secondActor.related('permissions').attach({
      [createPermission.id]: { granted: true, expires_at: null },
    })
    const firstService = createService(new UsersRepository())
    const secondService = createService(new UsersRepository())

    cleanup(async () => {
      await db
        .from('permissions')
        .where('resource', candidate.resource)
        .where('action', candidate.action)
        .where('context', candidate.context)
        .delete()
      await db.from('users').whereIn('id', [firstActor.id, secondActor.id]).delete()
      await new PermissionCacheService(new UsersRepository()).clearAllCache()
    })

    const [firstPermission, secondPermission] = await Promise.all([
      firstService.handle({ actorUserId: firstActor.id, data: candidate }),
      secondService.handle({ actorUserId: secondActor.id, data: candidate }),
    ])

    assert.equal(firstPermission.id, secondPermission.id)
    const rows = await db
      .from('permissions')
      .where('resource', candidate.resource)
      .where('action', candidate.action)
      .where('context', candidate.context)
    assert.lengthOf(rows, 1)
  })
})
