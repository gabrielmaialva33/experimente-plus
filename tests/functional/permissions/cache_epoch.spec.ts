import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'

import type Permission from '#modules/permissions/models/permission'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import type UsersRepository from '#modules/users/repositories/users_repository'

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

function permission(): Permission {
  return {
    id: 1,
    name: 'users.read',
    resource: 'users',
    action: 'read',
    context: 'any',
  } as Permission
}

function expiringPermission(expiresAt: Date): Permission {
  return {
    ...permission(),
    $extras: {
      pivot_expires_at: expiresAt.toISOString(),
    },
  } as Permission
}

function cacheService(): PermissionCacheService {
  return new PermissionCacheService({} as UsersRepository)
}

function role(): Role {
  const userRole = new Role()
  userRole.id = 1
  userRole.name = 'User'
  userRole.slug = IRole.Slugs.USER
  return userRole
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

test.group('Permission cache epoch', () => {
  test('rejects a stale database result when the epoch advances before CAS', async ({ assert }) => {
    const cache = cacheService()
    const snapshot = await cache.getUserPermissionsSnapshot(2_000_000_001)
    const databaseReadStarted = deferred()
    const releaseDatabaseRead = deferred()
    const oldDatabaseRead = (async () => {
      databaseReadStarted.resolve()
      await releaseDatabaseRead.promise
      return [permission()]
    })()

    await databaseReadStarted.promise
    await cache.bumpEpochAfterCommittedMutation()
    releaseDatabaseRead.resolve()

    const stalePermissions = await oldDatabaseRead
    const published = await cache.cacheUserPermissionsIfEpochUnchanged(
      2_000_000_001,
      snapshot.epoch,
      stalePermissions
    )
    const current = await cache.getUserPermissionsSnapshot(2_000_000_001)

    assert.isFalse(published)
    assert.notEqual(current.epoch, snapshot.epoch)
    assert.isNull(current.permissions)
  })

  test('keeps the epoch persistent and lets unreachable versioned keys expire by TTL', async ({
    assert,
  }) => {
    const cache = cacheService()
    const userId = 2_000_000_002
    const snapshot = await cache.getUserPermissionsSnapshot(userId)

    assert.isTrue(
      await cache.cacheUserPermissionsIfEpochUnchanged(userId, snapshot.epoch, [permission()])
    )

    const epochKeys = await redis.keys('acl:permissions:*:epoch')
    const cachedKeys = await redis.keys(`acl:permissions:*:v:*:user:${userId}`)
    assert.lengthOf(epochKeys, 1)
    assert.lengthOf(cachedKeys, 1)
    assert.equal(await redis.ttl(epochKeys[0]), -1)
    assert.isAbove(await redis.ttl(cachedKeys[0]), 0)

    await cache.clearAllCache()

    const current = await cache.getUserPermissionsSnapshot(userId)
    assert.equal(BigInt(current.epoch), BigInt(snapshot.epoch) + 1n)
    assert.isNull(current.permissions)
    assert.equal(await redis.exists(cachedKeys[0]), 1)
    assert.isAbove(await redis.ttl(cachedKeys[0]), 0)
    assert.equal(await redis.ttl(epochKeys[0]), -1)
    assert.deepEqual(await cache.getCacheStats(), {
      totalKeys: 0,
      userPermissions: 0,
      userRoles: 0,
      rolePermissions: 0,
      permissionChecks: 0,
    })
  })

  test('never serves a cached direct grant beyond its database expiration', async ({
    assert,
    cleanup,
  }) => {
    const realDateNow = Date.now
    const now = realDateNow()
    Date.now = () => now
    cleanup(() => {
      Date.now = realDateNow
    })

    const cache = cacheService()
    const userId = 2_000_000_003
    const snapshot = await cache.getUserPermissionsSnapshot(userId)
    assert.isTrue(
      await cache.cacheUserPermissionsIfEpochUnchanged(userId, snapshot.epoch, [
        expiringPermission(new Date(now + 5_000)),
      ])
    )
    const cached = await cache.getUserPermissionsSnapshot(userId)
    assert.lengthOf(cached.permissions!, 1)

    Date.now = () => now + 5_001

    const expired = await cache.getUserPermissionsSnapshot(userId)
    assert.isNull(expired.permissions)
  })

  test('does not resurrect an old generation if the persistent epoch key is lost', async ({
    assert,
  }) => {
    const cache = cacheService()
    const userId = 2_000_000_004
    const original = await cache.getUserPermissionsSnapshot(userId)
    assert.isTrue(
      await cache.cacheUserPermissionsIfEpochUnchanged(userId, original.epoch, [permission()])
    )

    const [epochKey] = await redis.keys('acl:permissions:*:epoch')
    await redis.del(epochKey)

    const recovered = await cache.getUserPermissionsSnapshot(userId)
    assert.notEqual(recovered.epoch, original.epoch)
    assert.isNull(recovered.permissions)
  })

  test('treats a structurally invalid cached grant as a miss', async ({ assert }) => {
    const cache = cacheService()
    const userId = 2_000_000_005
    const snapshot = await cache.getUserPermissionsSnapshot(userId)
    assert.isTrue(
      await cache.cacheUserPermissionsIfEpochUnchanged(userId, snapshot.epoch, [permission()])
    )

    const [cacheKey] = await redis.keys(`acl:permissions:*:v:*:user:${userId}`)
    const validPermission = {
      id: 1,
      name: 'users.read',
      resource: 'users',
      action: 'read',
      context: 'any',
    }
    const invalidPermissions = [
      { ...validPermission, id: '1' },
      { ...validPermission, resource: 'unknown_resource' },
      { ...validPermission, action: 'unknown_action' },
      { ...validPermission, context: 'unknown_context' },
      { ...validPermission, name: 'users.update' },
      { ...validPermission, injected: true },
    ]

    for (const invalidPermission of invalidPermissions) {
      await redis.set(
        cacheKey,
        JSON.stringify({
          permissions: [invalidPermission],
          valid_until: null,
        })
      )

      const invalid = await cache.getUserPermissionsSnapshot(userId)
      assert.isNull(invalid.permissions)
      assert.equal(await redis.exists(cacheKey), 0)
    }

    await redis.set(
      cacheKey,
      JSON.stringify({
        permissions: [validPermission],
        valid_until: null,
        injected: true,
      })
    )
    const invalidEnvelope = await cache.getUserPermissionsSnapshot(userId)
    assert.isNull(invalidEnvelope.permissions)
    assert.equal(await redis.exists(cacheKey), 0)
  })

  test('serializes concurrent epoch bumps without losing either mutation', async ({ assert }) => {
    const cache = cacheService()
    const before = await cache.getUserPermissionsSnapshot(2_000_000_006)

    await Promise.all([
      cache.bumpEpochAfterCommittedMutation(),
      cache.bumpEpochAfterCommittedMutation(),
    ])

    const after = await cache.getUserPermissionsSnapshot(2_000_000_006)
    assert.equal(BigInt(after.epoch), BigInt(before.epoch) + 2n)
  })

  test('releases a build lock only when the caller still owns its token', async ({ assert }) => {
    const cache = cacheService()
    const userId = 2_000_000_007

    assert.isTrue(await cache.tryAcquireUserPermissionBuildLock(userId, 'owner-a', 10_000))
    assert.isFalse(await cache.releaseUserPermissionBuildLock(userId, 'owner-b'))
    assert.isFalse(await cache.tryAcquireUserPermissionBuildLock(userId, 'owner-b', 10_000))

    const [lockKey] = await redis.keys(`acl:permissions:*:build:user:${userId}`)
    assert.isAbove(await redis.pttl(lockKey), 0)

    assert.isTrue(await cache.releaseUserPermissionBuildLock(userId, 'owner-a'))
    assert.isTrue(await cache.tryAcquireUserPermissionBuildLock(userId, 'owner-b', 10_000))
    assert.isTrue(await cache.releaseUserPermissionBuildLock(userId, 'owner-b'))
  })

  test('lets another owner recover after a crashed build lock expires in Redis', async ({
    assert,
  }) => {
    const cache = cacheService()
    const userId = 2_000_000_008
    assert.isTrue(await cache.tryAcquireUserPermissionBuildLock(userId, 'crashed-owner', 250))

    const deadline = Date.now() + 3_000
    let recovered = false
    while (!recovered && Date.now() < deadline) {
      recovered = await cache.tryAcquireUserPermissionBuildLock(userId, 'next-owner', 10_000)
      if (!recovered) {
        await wait(25)
      }
    }

    assert.isTrue(recovered)
    assert.isTrue(await cache.releaseUserPermissionBuildLock(userId, 'next-owner'))
  })

  test('treats a cached role with extra fields as corruption', async ({ assert }) => {
    const cache = cacheService()
    const userId = 2_000_000_009
    await cache.cacheUserRoles(userId, [role()])
    const [cacheKey] = await redis.keys(`acl:permissions:*:v:*:user_roles:${userId}`)
    await redis.set(
      cacheKey,
      JSON.stringify([{ id: 1, name: 'User', slug: 'user', injected: true }])
    )

    assert.isNull(await cache.getCachedUserRoles(userId))
    assert.equal(await redis.exists(cacheKey), 0)
  })

  test('treats an invalid cached existence marker as corruption', async ({ assert }) => {
    const cache = cacheService()
    await cache.cachePermissionExists('users', 'read', 'any', true)
    const [cacheKey] = await redis.keys('acl:permissions:*:v:*:permission:users:read:any')
    await redis.set(cacheKey, 'unexpected')

    assert.isNull(await cache.getCachedPermissionExists('users', 'read', 'any'))
    assert.equal(await redis.exists(cacheKey), 0)
  })
})
