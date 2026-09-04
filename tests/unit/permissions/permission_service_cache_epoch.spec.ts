import { test } from '@japa/runner'

import type Permission from '#modules/permissions/models/permission'
import type PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import type PermissionInheritanceService from '#modules/permissions/services/permission_inheritance_service'
import PermissionService, {
  type PermissionCoordinationTimings,
} from '#modules/permissions/services/permission_service'
import User from '#modules/users/models/user'
import type UsersRepository from '#modules/users/repositories/users_repository'
import type OwnershipService from '#shared/services/ownership_service'

type Deferred = {
  promise: Promise<void>
  resolve: () => void
}

type CacheDouble = Pick<
  PermissionCacheService,
  'getUserPermissionsSnapshot' | 'cacheUserPermissionsIfEpochUnchanged'
> &
  Partial<
    Pick<
      PermissionCacheService,
      'tryAcquireUserPermissionBuildLock' | 'releaseUserPermissionBuildLock'
    >
  >

class DeterministicPermissionService extends PermissionService {
  private now = 0

  protected currentTimeMilliseconds(): number {
    return this.now
  }

  protected async waitForBuildRetry(delayMilliseconds: number): Promise<void> {
    this.now += delayMilliseconds
  }
}

class ShortDeadlinePermissionService extends PermissionService {
  protected coordinationTimings(): PermissionCoordinationTimings {
    return {
      redisOperation: 100,
      databaseLoad: 25,
      ownerBuild: 75,
      lockLease: 100,
      lockWait: 125,
      totalBuild: 175,
      poll: 5,
    }
  }
}

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function permission(name: string): Permission {
  return {
    id: 1,
    name,
    resource: 'users',
    action: 'read',
    context: 'any',
  } as Permission
}

function userWithPermissions(permissions: Permission[]): User {
  const user = new User()
  user.$setRelated('permissions', permissions)
  user.$setRelated('roles', [])
  return user
}

function makeService(
  cacheService: CacheDouble,
  usersRepository: Pick<UsersRepository, 'findByIdWithActivePermissions'>,
  Service: typeof PermissionService = PermissionService
): PermissionService {
  const coordinatedCache = {
    async tryAcquireUserPermissionBuildLock() {
      return true
    },
    async releaseUserPermissionBuildLock() {
      return true
    },
    ...cacheService,
  }

  return new Service(
    coordinatedCache as unknown as PermissionCacheService,
    {} as PermissionInheritanceService,
    usersRepository as UsersRepository,
    {} as OwnershipService
  )
}

test.group('PermissionService cache epoch', () => {
  test('uses a cache hit without querying the database', async ({ assert }) => {
    const cachedPermission = permission('users.read')
    let queriedDatabase = false
    let attemptedWrite = false
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          return { epoch: '7', permissions: [cachedPermission] }
        },
        async cacheUserPermissionsIfEpochUnchanged() {
          attemptedWrite = true
          return true
        },
      },
      {
        async findByIdWithActivePermissions() {
          queriedDatabase = true
          return null
        },
      }
    )

    assert.deepEqual(await service.getEffectivePermissions(42), [cachedPermission])
    assert.isFalse(queriedDatabase)
    assert.isFalse(attemptedWrite)
  })

  test('restarts the database read when a mutation bumps the epoch before CAS', async ({
    assert,
  }) => {
    const oldPermission = permission('users.read')
    const oldDatabaseRead = deferred()
    const releaseOldDatabaseRead = deferred()
    const writes: Array<{ epoch: string; permissions: Permission[] }> = []
    let epoch = '0'
    let databaseReads = 0

    const cacheService = {
      async getUserPermissionsSnapshot() {
        return { epoch, permissions: null }
      },
      async cacheUserPermissionsIfEpochUnchanged(
        _userId: number,
        expectedEpoch: string,
        permissions: Permission[]
      ) {
        if (expectedEpoch !== epoch) {
          return false
        }

        writes.push({ epoch, permissions })
        return true
      },
    }
    const usersRepository = {
      async findByIdWithActivePermissions() {
        databaseReads++
        if (databaseReads === 1) {
          oldDatabaseRead.resolve()
          await releaseOldDatabaseRead.promise
          return userWithPermissions([oldPermission])
        }

        return userWithPermissions([])
      },
    }
    const service = makeService(cacheService, usersRepository)

    const resolving = service.getEffectivePermissions(42)
    await oldDatabaseRead.promise
    epoch = '1'
    releaseOldDatabaseRead.resolve()

    const permissions = await resolving

    assert.deepEqual(permissions, [])
    assert.equal(databaseReads, 2)
    assert.deepEqual(writes, [{ epoch: '1', permissions: [] }])
  })

  test('fails closed when the Redis snapshot cannot be read', async ({ assert }) => {
    let queriedDatabase = false
    const redisError = new Error('Redis unavailable')
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          throw redisError
        },
        async cacheUserPermissionsIfEpochUnchanged() {
          return true
        },
      },
      {
        async findByIdWithActivePermissions() {
          queriedDatabase = true
          return userWithPermissions([permission('users.read')])
        },
      }
    )

    await assert.rejects(() => service.getEffectivePermissions(42), 'Redis unavailable')
    assert.isFalse(queriedDatabase)
  })

  test('does not authorize a database result when the Redis CAS fails', async ({ assert }) => {
    const redisError = new Error('Redis unavailable during CAS')
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          return { epoch: '0', permissions: null }
        },
        async cacheUserPermissionsIfEpochUnchanged() {
          throw redisError
        },
      },
      {
        async findByIdWithActivePermissions() {
          return userWithPermissions([permission('users.read')])
        },
      }
    )

    await assert.rejects(() => service.getEffectivePermissions(42), 'Redis unavailable during CAS')
  })

  test('fails closed after three consecutive epoch changes', async ({ assert }) => {
    let snapshots = 0
    let databaseReads = 0
    let writes = 0
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          return { epoch: String(snapshots++), permissions: null }
        },
        async cacheUserPermissionsIfEpochUnchanged() {
          writes++
          return false
        },
      },
      {
        async findByIdWithActivePermissions() {
          databaseReads++
          return userWithPermissions([permission('users.read')])
        },
      }
    )

    await assert.rejects(
      () => service.getEffectivePermissions(42),
      'ACL cache epoch changed too frequently while resolving permissions'
    )
    // One pre-lock probe plus one snapshot for each of the three failed CAS attempts.
    assert.equal(snapshots, 4)
    assert.equal(databaseReads, 3)
    assert.equal(writes, 3)
  })

  test('resolves a multi-permission check from one effective snapshot', async ({ assert }) => {
    let snapshots = 0
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          snapshots++
          return { epoch: '4', permissions: [permission('users.read')] }
        },
        async cacheUserPermissionsIfEpochUnchanged() {
          return true
        },
      },
      {
        async findByIdWithActivePermissions() {
          throw new Error('Database should not be queried on a cache hit')
        },
      }
    )

    assert.isTrue(
      await service.checkUserPermission({
        user_id: 42,
        permission: ['users.read', 'users.update'],
      })
    )
    assert.equal(snapshots, 1)
  })

  test('shares one local build among concurrent readers for the same user', async ({ assert }) => {
    const databaseReadStarted = deferred()
    const releaseDatabaseRead = deferred()
    const effectivePermissions = [permission('users.read')]
    let cachedPermissions: Permission[] | null = null
    let databaseReads = 0
    let lockAcquisitions = 0
    let lockReleases = 0
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          return { epoch: '8', permissions: cachedPermissions }
        },
        async cacheUserPermissionsIfEpochUnchanged(_userId, _epoch, permissions) {
          cachedPermissions = permissions
          return true
        },
        async tryAcquireUserPermissionBuildLock() {
          lockAcquisitions++
          return true
        },
        async releaseUserPermissionBuildLock() {
          lockReleases++
          return true
        },
      },
      {
        async findByIdWithActivePermissions() {
          databaseReads++
          databaseReadStarted.resolve()
          await releaseDatabaseRead.promise
          return userWithPermissions(effectivePermissions)
        },
      }
    )

    const first = service.getEffectivePermissions(84)
    await databaseReadStarted.promise
    const second = service.getEffectivePermissions(84)
    releaseDatabaseRead.resolve()

    const [firstResult, secondResult] = await Promise.all([first, second])
    assert.deepEqual(firstResult, effectivePermissions)
    assert.deepEqual(secondResult, effectivePermissions)
    assert.equal(databaseReads, 1)
    assert.equal(lockAcquisitions, 1)
    assert.equal(lockReleases, 1)
  })

  test('revalidates the epoch before sharing a completed local build', async ({ assert }) => {
    const firstPublishCompleted = deferred()
    const releaseFirstPublishResponse = deferred()
    const oldPermissions = [permission('users.read')]
    const cachedByEpoch = new Map<string, Permission[]>()
    let epoch = '0'
    let databaseReads = 0
    let publications = 0
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          return { epoch, permissions: cachedByEpoch.get(epoch) ?? null }
        },
        async cacheUserPermissionsIfEpochUnchanged(_userId, expectedEpoch, permissions) {
          if (expectedEpoch !== epoch) {
            return false
          }

          cachedByEpoch.set(epoch, permissions)
          publications++
          if (publications === 1) {
            firstPublishCompleted.resolve()
            await releaseFirstPublishResponse.promise
          }
          return true
        },
      },
      {
        async findByIdWithActivePermissions() {
          databaseReads++
          return userWithPermissions(databaseReads === 1 ? oldPermissions : [])
        },
      }
    )

    const first = service.getEffectivePermissions(90)
    await firstPublishCompleted.promise
    epoch = '1'
    const second = service.getEffectivePermissions(90)
    releaseFirstPublishResponse.resolve()

    assert.deepEqual(await first, oldPermissions)
    assert.deepEqual(await second, [])
    assert.equal(databaseReads, 2)
    assert.equal(publications, 2)
  })

  test('recovers after a crashed distributed owner lock expires', async ({ assert }) => {
    let lockAttempts = 0
    let databaseReads = 0
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          return { epoch: '9', permissions: null }
        },
        async cacheUserPermissionsIfEpochUnchanged() {
          return true
        },
        async tryAcquireUserPermissionBuildLock() {
          lockAttempts++
          return lockAttempts > 100
        },
        async releaseUserPermissionBuildLock() {
          return true
        },
      },
      {
        async findByIdWithActivePermissions() {
          databaseReads++
          return userWithPermissions([])
        },
      },
      DeterministicPermissionService
    )

    assert.deepEqual(await service.getEffectivePermissions(85), [])
    assert.equal(lockAttempts, 101)
    assert.equal(databaseReads, 1)
  })

  test('fails closed when a distributed build lock outlives the bounded wait', async ({
    assert,
  }) => {
    let databaseReads = 0
    let lockAttempts = 0
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          return { epoch: '10', permissions: null }
        },
        async cacheUserPermissionsIfEpochUnchanged() {
          return true
        },
        async tryAcquireUserPermissionBuildLock() {
          lockAttempts++
          return false
        },
        async releaseUserPermissionBuildLock() {
          return false
        },
      },
      {
        async findByIdWithActivePermissions() {
          databaseReads++
          return userWithPermissions([permission('users.read')])
        },
      },
      DeterministicPermissionService
    )

    await assert.rejects(
      () => service.getEffectivePermissions(86),
      'Timed out waiting for the ACL permission cache build lock'
    )
    assert.equal(lockAttempts, 111)
    assert.equal(databaseReads, 0)
  })

  test('clears a timed-out local build so a later reader can recover', async ({ assert }) => {
    let databaseReads = 0
    let databaseIsHung = true
    let lockReleases = 0
    const cacheService: CacheDouble = {
      async getUserPermissionsSnapshot() {
        return { epoch: '12', permissions: null }
      },
      async cacheUserPermissionsIfEpochUnchanged() {
        return true
      },
      async tryAcquireUserPermissionBuildLock() {
        return true
      },
      async releaseUserPermissionBuildLock() {
        lockReleases++
        return true
      },
    }
    const usersRepository = {
      async findByIdWithActivePermissions() {
        databaseReads++
        if (databaseIsHung) {
          return new Promise<User | null>(() => {})
        }

        return userWithPermissions([])
      },
    }
    const service = makeService(cacheService, usersRepository, ShortDeadlinePermissionService)

    await assert.rejects(
      () => service.getEffectivePermissions(87),
      'Timed out loading effective permissions from the database'
    )
    databaseIsHung = false

    assert.deepEqual(await service.getEffectivePermissions(87), [])
    assert.equal(databaseReads, 2)
    assert.equal(lockReleases, 2)
  })

  test('does not mask a successful build when lock release fails', async ({ assert }) => {
    const expected = [permission('users.read')]
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          return { epoch: '13', permissions: null }
        },
        async cacheUserPermissionsIfEpochUnchanged() {
          return true
        },
        async releaseUserPermissionBuildLock() {
          throw new Error('Redis release failed')
        },
      },
      {
        async findByIdWithActivePermissions() {
          return userWithPermissions(expected)
        },
      }
    )

    assert.deepEqual(await service.getEffectivePermissions(88), expected)
  })

  test('does not mask the database error when lock release also fails', async ({ assert }) => {
    const service = makeService(
      {
        async getUserPermissionsSnapshot() {
          return { epoch: '14', permissions: null }
        },
        async cacheUserPermissionsIfEpochUnchanged() {
          return true
        },
        async releaseUserPermissionBuildLock() {
          throw new Error('Redis release failed')
        },
      },
      {
        async findByIdWithActivePermissions() {
          throw new Error('Database load failed')
        },
      }
    )

    await assert.rejects(() => service.getEffectivePermissions(89), 'Database load failed')
  })

  test('groups batch checks by user before resolving effective permissions', async ({ assert }) => {
    const snapshotsByUser = new Map<number, number>()
    const service = makeService(
      {
        async getUserPermissionsSnapshot(userId) {
          snapshotsByUser.set(userId, (snapshotsByUser.get(userId) ?? 0) + 1)
          return { epoch: '11', permissions: [permission('users.read')] }
        },
        async cacheUserPermissionsIfEpochUnchanged() {
          return true
        },
      },
      {
        async findByIdWithActivePermissions() {
          throw new Error('Database should not be queried on a cache hit')
        },
      }
    )

    const results = await service.batchCheckPermissions([
      { userId: 1, permission: 'users.read' },
      { userId: 1, permission: 'users.read' },
      { userId: 2, permission: 'users.read' },
    ])

    assert.deepEqual(
      results.map((result) => result.granted),
      [true, true, true]
    )
    assert.deepEqual(
      [...snapshotsByUser],
      [
        [1, 1],
        [2, 1],
      ]
    )
  })
})
