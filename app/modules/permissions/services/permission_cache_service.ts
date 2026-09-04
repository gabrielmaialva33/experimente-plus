import { randomInt } from 'node:crypto'

import { inject } from '@adonisjs/core'
import redis from '@adonisjs/redis/services/main'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import Permission from '#modules/permissions/models/permission'
import { canonicalPermissionName } from '#modules/permissions/permission_name'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import UsersRepository from '#modules/users/repositories/users_repository'

const READ_VERSIONED_CACHE_SCRIPT = `
redis.call('SETNX', KEYS[1], ARGV[1])
redis.call('PERSIST', KEYS[1])

local epoch = redis.call('GET', KEYS[1])
if epoch ~= ARGV[2] then
  return { epoch, false }
end

local value = redis.call('GET', KEYS[2])
return { epoch, value or false }
`

const WRITE_IF_EPOCH_UNCHANGED_SCRIPT = `
local epoch = redis.call('GET', KEYS[1])
if not epoch or epoch ~= ARGV[1] then
  return 0
end

redis.call('PERSIST', KEYS[1])
redis.call('SETEX', KEYS[2], ARGV[2], ARGV[3])
return 1
`

const BUMP_EPOCH_SCRIPT = `
redis.call('SETNX', KEYS[1], ARGV[1])
redis.call('INCR', KEYS[1])
redis.call('PERSIST', KEYS[1])
return redis.call('GET', KEYS[1])
`

const RELEASE_BUILD_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end

return redis.call('DEL', KEYS[1])
`

const PERMISSION_CACHE_KEYS = ['id', 'name', 'resource', 'action', 'context'] as const
const ROLE_CACHE_KEYS = ['id', 'name', 'slug'] as const
const USER_PERMISSION_PAYLOAD_KEYS = ['permissions', 'valid_until'] as const
const VALID_PERMISSION_RESOURCES = new Set<string>(Object.values(IPermission.Resources))
const VALID_PERMISSION_ACTIONS = new Set<string>(Object.values(IPermission.Actions))
const VALID_PERMISSION_CONTEXTS = new Set<string>(Object.values(IPermission.Contexts))

type RawCacheSnapshot = {
  epoch: string
  value: string | null
}

type CachedPermission = {
  id: number
  name: string
  resource: string
  action: string
  context: string
}

type UserPermissionCachePayload = {
  permissions: CachedPermission[]
  valid_until: number | null
}

export type UserPermissionCacheSnapshot = {
  epoch: string
  permissions: Permission[] | null
}

@inject()
export default class PermissionCacheService {
  private readonly CACHE_PREFIX = 'acl:permissions'
  private readonly CACHE_SLOT = '{acl}'
  private readonly DEFAULT_TTL = 3600 // 1 hour in seconds
  private readonly ROLE_TTL = 7200 // 2 hours in seconds

  constructor(private _usersRepository: UsersRepository) {}

  /**
   * Read the epoch and the matching user cache entry in one Redis script.
   * A concurrent bump is represented as a miss at the newer epoch.
   */
  async getUserPermissionsSnapshot(userId: number): Promise<UserPermissionCacheSnapshot> {
    const suffix = this.USER_PERMISSIONS_SUFFIX(userId)
    const snapshot = await this.readVersionedCache(suffix)

    if (!snapshot.value) {
      return { epoch: snapshot.epoch, permissions: null }
    }

    try {
      const payload = this.parseUserPermissionPayload(JSON.parse(snapshot.value))
      if (payload.valid_until !== null && payload.valid_until <= Date.now()) {
        await redis.del(this.VERSIONED_CACHE_KEY(snapshot.epoch, suffix))
        return { epoch: snapshot.epoch, permissions: null }
      }

      return {
        epoch: snapshot.epoch,
        permissions: payload.permissions.map((item) => this.hydratePermission(item)),
      }
    } catch {
      await redis.del(this.VERSIONED_CACHE_KEY(snapshot.epoch, suffix))
      return { epoch: snapshot.epoch, permissions: null }
    }
  }

  /**
   * Publish data loaded after the matching snapshot only when no ACL mutation
   * advanced the epoch in the meantime.
   */
  async cacheUserPermissionsIfEpochUnchanged(
    userId: number,
    expectedEpoch: string,
    permissions: Permission[]
  ): Promise<boolean> {
    const validUntil = this.nearestDirectGrantExpiration(permissions)
    if (validUntil !== null && validUntil <= Date.now()) {
      return false
    }

    const payload: UserPermissionCachePayload = {
      valid_until: validUntil,
      permissions: permissions.map((permission) => ({
        id: permission.id,
        name: permission.name,
        resource: permission.resource,
        action: permission.action,
        context: permission.context || 'any',
      })),
    }
    const ttl =
      validUntil === null
        ? this.DEFAULT_TTL
        : Math.max(1, Math.min(this.DEFAULT_TTL, Math.floor((validUntil - Date.now()) / 1000)))

    return this.writeVersionedCacheIfEpochUnchanged(
      this.USER_PERMISSIONS_SUFFIX(userId),
      expectedEpoch,
      ttl,
      JSON.stringify(payload)
    )
  }

  /**
   * Compatibility read for consumers that do not need to populate a miss.
   */
  async getCachedUserPermissions(userId: number): Promise<Permission[] | null> {
    const snapshot = await this.getUserPermissionsSnapshot(userId)
    return snapshot.permissions
  }

  async cacheUserRoles(userId: number, roles: Role[]): Promise<void> {
    const snapshot = await this.readVersionedCache(this.USER_ROLES_SUFFIX(userId))
    const roleData = roles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
    }))

    await this.writeVersionedCacheIfEpochUnchanged(
      this.USER_ROLES_SUFFIX(userId),
      snapshot.epoch,
      this.ROLE_TTL,
      JSON.stringify(roleData)
    )
  }

  async getCachedUserRoles(userId: number): Promise<Role[] | null> {
    const suffix = this.USER_ROLES_SUFFIX(userId)
    const snapshot = await this.readVersionedCache(suffix)

    if (!snapshot.value) {
      return null
    }

    try {
      const roleData = JSON.parse(snapshot.value) as unknown
      if (!Array.isArray(roleData)) {
        throw new Error('Invalid cached roles')
      }

      return roleData.map((candidate) => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
          throw new Error('Invalid cached role')
        }

        const item = candidate as Record<string, unknown>
        if (
          !this.hasExactKeys(item, ROLE_CACHE_KEYS) ||
          !Number.isInteger(item.id) ||
          Number(item.id) < 1 ||
          typeof item.name !== 'string' ||
          item.name.length === 0 ||
          typeof item.slug !== 'string' ||
          !IRole.isCanonicalSlug(item.slug)
        ) {
          throw new Error('Invalid cached role')
        }

        const role = new Role()
        role.id = Number(item.id)
        role.name = item.name
        role.slug = item.slug
        return role
      })
    } catch {
      await redis.del(this.VERSIONED_CACHE_KEY(snapshot.epoch, suffix))
      return null
    }
  }

  async cacheRolePermissions(roleId: number, permissions: Permission[]): Promise<void> {
    const suffix = this.ROLE_PERMISSIONS_SUFFIX(roleId)
    const snapshot = await this.readVersionedCache(suffix)
    const permissionData = permissions.map((permission) => ({
      id: permission.id,
      name: permission.name,
      resource: permission.resource,
      action: permission.action,
      context: permission.context || 'any',
    }))

    await this.writeVersionedCacheIfEpochUnchanged(
      suffix,
      snapshot.epoch,
      this.ROLE_TTL,
      JSON.stringify(permissionData)
    )
  }

  async getCachedRolePermissions(roleId: number): Promise<Permission[] | null> {
    const suffix = this.ROLE_PERMISSIONS_SUFFIX(roleId)
    const snapshot = await this.readVersionedCache(suffix)

    if (!snapshot.value) {
      return null
    }

    try {
      const permissionData = this.parseCachedPermissions(JSON.parse(snapshot.value))
      return permissionData.map((item) => this.hydratePermission(item))
    } catch {
      await redis.del(this.VERSIONED_CACHE_KEY(snapshot.epoch, suffix))
      return null
    }
  }

  async cachePermissionExists(
    resource: string,
    action: string,
    context: string = 'any',
    exists: boolean
  ): Promise<void> {
    const suffix = this.PERMISSION_SUFFIX(resource, action, context)
    const snapshot = await this.readVersionedCache(suffix)

    await this.writeVersionedCacheIfEpochUnchanged(
      suffix,
      snapshot.epoch,
      this.DEFAULT_TTL,
      exists ? '1' : '0'
    )
  }

  async getCachedPermissionExists(
    resource: string,
    action: string,
    context: string = 'any'
  ): Promise<boolean | null> {
    const snapshot = await this.readVersionedCache(
      this.PERMISSION_SUFFIX(resource, action, context)
    )

    if (snapshot.value === null) {
      return null
    }

    if (snapshot.value !== '0' && snapshot.value !== '1') {
      await redis.del(
        this.VERSIONED_CACHE_KEY(snapshot.epoch, this.PERMISSION_SUFFIX(resource, action, context))
      )
      return null
    }

    return snapshot.value === '1'
  }

  async tryAcquireUserPermissionBuildLock(
    userId: number,
    token: string,
    ttlMilliseconds: number
  ): Promise<boolean> {
    const result = await redis.set(
      this.USER_PERMISSION_BUILD_LOCK_KEY(userId),
      token,
      'PX',
      ttlMilliseconds,
      'NX'
    )

    if (result !== null && result !== 'OK') {
      throw new Error('Redis returned an invalid ACL build lock result')
    }

    return result === 'OK'
  }

  async releaseUserPermissionBuildLock(userId: number, token: string): Promise<boolean> {
    const result = await redis.eval(
      RELEASE_BUILD_LOCK_SCRIPT,
      1,
      this.USER_PERMISSION_BUILD_LOCK_KEY(userId),
      token
    )

    if (result !== 0 && result !== 1) {
      throw new Error('Redis returned an invalid ACL build lock release result')
    }

    return result === 1
  }

  async invalidateUserCache(_userId: number): Promise<void> {
    await this.bumpEpochAfterCommittedMutation()
  }

  async invalidateRoleCache(_roleId: number): Promise<void> {
    await this.bumpEpochAfterCommittedMutation()
  }

  async invalidateAllUserCaches(): Promise<void> {
    await this.bumpEpochAfterCommittedMutation()
  }

  async invalidateAllRoleCaches(): Promise<void> {
    await this.bumpEpochAfterCommittedMutation()
  }

  async invalidatePermissionCache(
    _resource: string,
    _action: string,
    _context: string = 'any'
  ): Promise<void> {
    await this.bumpEpochAfterCommittedMutation()
  }

  /**
   * Diagnostic counts for the current epoch on the configured connection.
   * SCAN is complete for the standalone deployment; a future Redis Cluster
   * adapter must aggregate every primary node before exposing global totals.
   */
  async getCacheStats(): Promise<{
    totalKeys: number
    userPermissions: number
    userRoles: number
    rolePermissions: number
    permissionChecks: number
  }> {
    const snapshot = await this.readVersionedCache(':stats')
    const allKeys = await this.scanKeys(
      `${this.CACHE_PREFIX}:${this.CACHE_SLOT}:v:${snapshot.epoch}:*`
    )

    const userPermissions = allKeys.filter(
      (key) => key.includes(':user:') && !key.includes(':user_roles:')
    ).length
    const userRoles = allKeys.filter((key) => key.includes(':user_roles:')).length
    const rolePermissions = allKeys.filter((key) => key.includes(':role:')).length
    const permissionChecks = allKeys.filter((key) => key.includes(':permission:')).length

    return {
      totalKeys: allKeys.length,
      userPermissions,
      userRoles,
      rolePermissions,
      permissionChecks,
    }
  }

  /**
   * Advance the global ACL epoch exactly once after a successful database
   * mutation. Versioned entries from older epochs remain unreachable and
   * expire through their regular TTL, so correctness never depends on SCAN.
   *
   * This is still a database/Redis dual write: a process crash after COMMIT
   * and before INCR can leave the previous epoch visible until its cache TTL.
   * PERSIST only removes the key TTL; a Redis persistence rollback can likewise
   * restore an older epoch alongside older cache entries.
   * Closing that residual window requires a generation committed in the same
   * database transaction (or a durable outbox/CDC), then consulted on reads.
   */
  async bumpEpochAfterCommittedMutation(): Promise<void> {
    const result = await redis.eval(BUMP_EPOCH_SCRIPT, 1, this.EPOCH_KEY, this.newEpochSeed())
    this.parseEpoch(result)
  }

  async clearAllCache(): Promise<void> {
    await this.bumpEpochAfterCommittedMutation()
  }

  private async readVersionedCache(suffix: string): Promise<RawCacheSnapshot> {
    const storedEpoch = await redis.get(this.EPOCH_KEY)
    const candidateEpoch = storedEpoch === null ? this.newEpochSeed() : this.parseEpoch(storedEpoch)
    const result = await redis.eval(
      READ_VERSIONED_CACHE_SCRIPT,
      2,
      this.EPOCH_KEY,
      this.VERSIONED_CACHE_KEY(candidateEpoch, suffix),
      candidateEpoch,
      candidateEpoch
    )

    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('Redis returned an invalid ACL cache snapshot')
    }

    const epoch = this.parseEpoch(result[0])
    const value = result[1]
    if (value !== null && value !== false && typeof value !== 'string') {
      throw new Error('Redis returned an invalid ACL cache value')
    }

    return { epoch, value: typeof value === 'string' ? value : null }
  }

  private async writeVersionedCacheIfEpochUnchanged(
    suffix: string,
    expectedEpoch: string,
    ttl: number,
    value: string
  ): Promise<boolean> {
    const epoch = this.parseEpoch(expectedEpoch)
    const result = await redis.eval(
      WRITE_IF_EPOCH_UNCHANGED_SCRIPT,
      2,
      this.EPOCH_KEY,
      this.VERSIONED_CACHE_KEY(epoch, suffix),
      epoch,
      ttl,
      value
    )

    if (result !== 0 && result !== 1) {
      throw new Error('Redis returned an invalid ACL cache write result')
    }

    return result === 1
  }

  private parseEpoch(value: unknown): string {
    const epoch = typeof value === 'number' ? String(value) : value
    if (typeof epoch !== 'string' || !/^\d+$/.test(epoch)) {
      throw new Error('Redis returned an invalid ACL cache epoch')
    }

    return epoch
  }

  private newEpochSeed(): string {
    const unixSeconds = BigInt(Math.floor(Date.now() / 1000))
    return String(unixSeconds * 1_000_000_000n + BigInt(randomInt(0, 1_000_000_000)))
  }

  private parseUserPermissionPayload(value: unknown): UserPermissionCachePayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid cached user permission payload')
    }

    const candidate = value as Record<string, unknown>
    if (!this.hasExactKeys(candidate, USER_PERMISSION_PAYLOAD_KEYS)) {
      throw new Error('Invalid cached user permission payload')
    }

    const validUntil = candidate.valid_until
    if (
      validUntil !== null &&
      (typeof validUntil !== 'number' || !Number.isFinite(validUntil) || validUntil <= 0)
    ) {
      throw new Error('Invalid cached user permission expiration')
    }

    return {
      permissions: this.parseCachedPermissions(candidate.permissions),
      valid_until: validUntil,
    }
  }

  private parseCachedPermissions(value: unknown): CachedPermission[] {
    if (!Array.isArray(value)) {
      throw new Error('Invalid cached permissions')
    }

    return value.map((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new Error('Invalid cached permission')
      }

      const permission = candidate as Record<string, unknown>
      if (
        !this.hasExactKeys(permission, PERMISSION_CACHE_KEYS) ||
        !Number.isInteger(permission.id) ||
        Number(permission.id) < 1 ||
        typeof permission.name !== 'string' ||
        permission.name.length === 0 ||
        typeof permission.resource !== 'string' ||
        permission.resource.length === 0 ||
        typeof permission.action !== 'string' ||
        permission.action.length === 0 ||
        typeof permission.context !== 'string' ||
        !VALID_PERMISSION_RESOURCES.has(permission.resource) ||
        !VALID_PERMISSION_ACTIONS.has(permission.action) ||
        !VALID_PERMISSION_CONTEXTS.has(permission.context) ||
        permission.name !==
          canonicalPermissionName(permission.resource, permission.action, permission.context)
      ) {
        throw new Error('Invalid cached permission')
      }

      return {
        id: Number(permission.id),
        name: permission.name,
        resource: permission.resource,
        action: permission.action,
        context: permission.context,
      }
    })
  }

  private hydratePermission(item: CachedPermission): Permission {
    const permission = new Permission()
    permission.id = item.id
    permission.name = item.name
    permission.resource = item.resource
    permission.action = item.action
    permission.context = item.context
    return permission
  }

  private nearestDirectGrantExpiration(permissions: Permission[]): number | null {
    let nearest: number | null = null

    for (const permission of permissions) {
      const rawExpiration = permission.$extras?.pivot_expires_at
      if (rawExpiration === undefined || rawExpiration === null) {
        continue
      }

      const expiration = this.expirationToMilliseconds(rawExpiration)
      nearest = nearest === null ? expiration : Math.min(nearest, expiration)
    }

    return nearest
  }

  private expirationToMilliseconds(value: unknown): number {
    let milliseconds: number

    if (value instanceof Date) {
      milliseconds = value.getTime()
    } else if (typeof value === 'number') {
      milliseconds = value
    } else if (typeof value === 'string') {
      milliseconds = Date.parse(value)
    } else if (
      value !== null &&
      typeof value === 'object' &&
      'toMillis' in value &&
      typeof value.toMillis === 'function'
    ) {
      milliseconds = value.toMillis()
    } else {
      milliseconds = Number.NaN
    }

    if (!Number.isFinite(milliseconds)) {
      throw new Error('Database returned an invalid direct permission expiration')
    }

    return milliseconds
  }

  private hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
    const keys = Object.keys(value)
    return keys.length === expectedKeys.length && expectedKeys.every((key) => key in value)
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    let cursor = '0'
    const keys: string[] = []

    do {
      const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      keys.push(...batch)
    } while (cursor !== '0')

    return keys
  }

  private readonly EPOCH_KEY = `${this.CACHE_PREFIX}:${this.CACHE_SLOT}:epoch`

  private readonly VERSIONED_CACHE_KEY = (epoch: string, suffix: string) =>
    `${this.CACHE_PREFIX}:${this.CACHE_SLOT}:v:${epoch}${suffix}`

  private readonly USER_PERMISSIONS_SUFFIX = (userId: number) => `:user:${userId}`

  private readonly ROLE_PERMISSIONS_SUFFIX = (roleId: number) => `:role:${roleId}`

  private readonly USER_ROLES_SUFFIX = (userId: number) => `:user_roles:${userId}`

  private readonly USER_PERMISSION_BUILD_LOCK_KEY = (userId: number) =>
    `${this.CACHE_PREFIX}:${this.CACHE_SLOT}:build:user:${userId}`

  private readonly PERMISSION_SUFFIX = (
    resource: string,
    action: string,
    context: string = 'any'
  ) => `:permission:${resource}:${action}:${context}`
}
