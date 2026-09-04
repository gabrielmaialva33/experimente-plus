import { randomUUID } from 'node:crypto'

import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'

import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import PermissionInheritanceService from '#modules/permissions/services/permission_inheritance_service'

import Permission from '#modules/permissions/models/permission'
import UsersRepository from '#modules/users/repositories/users_repository'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import OwnershipService from '#shared/services/ownership_service'

const CACHE_EPOCH_RETRY_LIMIT = 3
const DEFAULT_COORDINATION_TIMINGS = {
  redisOperation: 750,
  databaseLoad: 2_500,
  ownerBuild: 4_500,
  lockLease: 5_000,
  lockWait: 5_500,
  totalBuild: 10_500,
  poll: 50,
} as const
const inFlightPermissionBuilds = new Map<number, Promise<Permission[]>>()

export type PermissionCoordinationTimings = {
  redisOperation: number
  databaseLoad: number
  ownerBuild: number
  lockLease: number
  lockWait: number
  totalBuild: number
  poll: number
}

@inject()
export default class PermissionService {
  constructor(
    private cacheService: PermissionCacheService,
    private inheritanceService: PermissionInheritanceService,
    private usersRepository: UsersRepository,
    private ownershipService: OwnershipService
  ) {}

  /**
   * Check user permission with caching and inheritance
   */
  async checkUserPermission(data: IPermission.PermissionCheck): Promise<boolean> {
    const {
      user_id: userId,
      permission,
      requireAll = false,
      context,
      resource_id: resourceId,
    } = data
    const userPermissions = await this.getEffectivePermissions(userId)

    // Handle single permission
    if (typeof permission === 'string') {
      return await this.checkSinglePermission(
        userId,
        userPermissions,
        permission,
        context,
        resourceId
      )
    }

    // Handle multiple permissions
    const results = await Promise.all(
      permission.map((item) =>
        this.checkSinglePermission(userId, userPermissions, item, context, resourceId)
      )
    )

    return requireAll ? results.every(Boolean) : results.some(Boolean)
  }

  /**
   * Batch check permissions for multiple users
   */
  async batchCheckPermissions(
    checks: Array<{
      userId: number
      permission: string
      context?: string
      resourceId?: number
    }>
  ): Promise<Array<{ userId: number; permission: string; granted: boolean }>> {
    const permissionsByUser = new Map<number, Permission[]>()
    await Promise.all(
      [...new Set(checks.map((check) => check.userId))].map(async (userId) => {
        permissionsByUser.set(userId, await this.getEffectivePermissions(userId))
      })
    )

    const results = await Promise.all(
      checks.map(async (check) => {
        const userPermissions = permissionsByUser.get(check.userId)
        if (!userPermissions) {
          throw new Error('Effective permission snapshot is missing for batch user')
        }

        const granted = await this.checkSinglePermission(
          check.userId,
          userPermissions,
          check.permission,
          check.context,
          check.resourceId
        )

        return {
          userId: check.userId,
          permission: check.permission,
          granted,
        }
      })
    )

    return results
  }

  /**
   * Pre-warm cache for multiple users
   */
  async preWarmCache(userIds: number[]): Promise<void> {
    await Promise.all(userIds.map((userId) => this.getEffectivePermissions(userId)))
  }

  /**
   * Resolve effective permissions through direct grants, roles and inheritance.
   * The same cached path is shared by middleware and Inertia UI capabilities.
   */
  async getEffectivePermissions(userId: number): Promise<Permission[]> {
    const timings = this.coordinationTimings()
    const snapshot = await this.withDeadline(
      () => this.cacheService.getUserPermissionsSnapshot(userId),
      timings.redisOperation,
      'Timed out reading the ACL permission cache'
    )
    if (snapshot.permissions) {
      return snapshot.permissions
    }

    const existingBuild = inFlightPermissionBuilds.get(userId)
    if (existingBuild) {
      await existingBuild

      // A local build may have published immediately before an ACL epoch bump.
      // Re-read the current generation instead of returning its now-stale value
      // to a caller that already observed a miss in the newer generation.
      const completedSnapshot = await this.withDeadline(
        () => this.cacheService.getUserPermissionsSnapshot(userId),
        timings.redisOperation,
        'Timed out validating the completed ACL permission cache build'
      )
      if (completedSnapshot.permissions) {
        return completedSnapshot.permissions
      }

      if (inFlightPermissionBuilds.get(userId) === existingBuild) {
        inFlightPermissionBuilds.delete(userId)
      }
      return this.getEffectivePermissions(userId)
    }

    const build = this.withDeadline(
      () => this.buildUserPermissionsWithDistributedLock(userId),
      timings.totalBuild,
      'Timed out building the ACL permission cache'
    )
    inFlightPermissionBuilds.set(userId, build)

    try {
      return await build
    } finally {
      if (inFlightPermissionBuilds.get(userId) === build) {
        inFlightPermissionBuilds.delete(userId)
      }
    }
  }

  private async buildUserPermissionsWithDistributedLock(userId: number): Promise<Permission[]> {
    const timings = this.coordinationTimings()
    const deadline = this.currentTimeMilliseconds() + timings.lockWait

    while (true) {
      const token = randomUUID()
      const acquired = await this.withDeadline(
        () => this.cacheService.tryAcquireUserPermissionBuildLock(userId, token, timings.lockLease),
        timings.redisOperation,
        'Timed out acquiring the ACL permission cache build lock'
      )

      if (acquired) {
        try {
          return await this.withDeadline(
            () => this.loadAndPublishUserPermissions(userId),
            timings.ownerBuild,
            'Timed out loading the ACL permission snapshot'
          )
        } finally {
          await this.releaseBuildLockSafely(userId, token)
        }
      }

      const snapshot = await this.withDeadline(
        () => this.cacheService.getUserPermissionsSnapshot(userId),
        timings.redisOperation,
        'Timed out reading the ACL permission cache while waiting for its build lock'
      )
      if (snapshot.permissions) {
        return snapshot.permissions
      }

      const remaining = deadline - this.currentTimeMilliseconds()
      if (remaining <= 0) {
        throw new Error('Timed out waiting for the ACL permission cache build lock')
      }

      await this.waitForBuildRetry(Math.min(timings.poll, remaining))
    }
  }

  private async releaseBuildLockSafely(userId: number, token: string): Promise<void> {
    const timings = this.coordinationTimings()
    try {
      await this.withDeadline(
        () => this.cacheService.releaseUserPermissionBuildLock(userId, token),
        timings.redisOperation,
        'Timed out releasing the ACL permission cache build lock'
      )
    } catch (error) {
      // Release is ownership-checked and the lease has a TTL. Once the CAS has
      // succeeded, a cleanup failure cannot make the permission result stale.
      logger.warn({ err: error, user_id: userId }, 'ACL permission build lock release failed')
    }
  }

  private async loadAndPublishUserPermissions(userId: number): Promise<Permission[]> {
    for (let attempt = 0; attempt < CACHE_EPOCH_RETRY_LIMIT; attempt++) {
      const timings = this.coordinationTimings()
      const snapshot = await this.withDeadline(
        () => this.cacheService.getUserPermissionsSnapshot(userId),
        timings.redisOperation,
        'Timed out reading the ACL permission cache during its build'
      )
      if (snapshot.permissions) {
        return snapshot.permissions
      }

      const permissions = await this.withDeadline(
        () => this.loadUserPermissionsOptimized(userId),
        timings.databaseLoad,
        'Timed out loading effective permissions from the database'
      )
      const published = await this.withDeadline(
        () =>
          this.cacheService.cacheUserPermissionsIfEpochUnchanged(
            userId,
            snapshot.epoch,
            permissions
          ),
        timings.redisOperation,
        'Timed out publishing the ACL permission cache'
      )

      if (published) {
        return permissions
      }
    }

    // Repeated ACL changes can keep invalidating the database snapshot. Never
    // authorize with a result that Redis refused to publish for the current epoch.
    throw new Error('ACL cache epoch changed too frequently while resolving permissions')
  }

  protected currentTimeMilliseconds(): number {
    return Date.now()
  }

  protected coordinationTimings(): PermissionCoordinationTimings {
    return DEFAULT_COORDINATION_TIMINGS
  }

  protected async waitForBuildRetry(delayMilliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMilliseconds)
    })
  }

  private withDeadline<T>(
    operation: () => Promise<T>,
    timeoutMilliseconds: number,
    timeoutMessage: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        settled = true
        reject(new Error(timeoutMessage))
      }, timeoutMilliseconds)

      let operationPromise: Promise<T>
      try {
        operationPromise = operation()
      } catch (error) {
        clearTimeout(timeout)
        reject(error)
        return
      }

      void operationPromise.then(
        (value) => {
          if (settled) {
            return
          }
          settled = true
          clearTimeout(timeout)
          resolve(value)
        },
        (error: unknown) => {
          if (settled) {
            return
          }
          settled = true
          clearTimeout(timeout)
          reject(error)
        }
      )
    })
  }

  async getEffectivePermissionNames(userId: number): Promise<string[]> {
    const permissions = await this.getEffectivePermissions(userId)
    return permissions.map((permission) => permission.name)
  }

  /**
   * Get user permission summary
   */
  async getUserPermissionSummary(userId: number): Promise<{
    directPermissions: Permission[]
    rolePermissions: Permission[]
    effectivePermissions: Permission[]
    roles: string[]
  }> {
    const user = await this.usersRepository.findByIdWithPermissionsAndRoles(userId)

    if (!user) {
      return {
        directPermissions: [],
        rolePermissions: [],
        effectivePermissions: [],
        roles: [],
      }
    }

    const directPermissions = user.permissions
    const rolePermissions = new Map<number, Permission>()
    const roles = user.roles.map((role) => role.slug)

    // Collect all role permissions with inheritance
    for (const role of user.roles) {
      const effectiveRolePermissions = await this.inheritanceService.getEffectivePermissions(
        role.slug
      )
      effectiveRolePermissions.forEach((permission) => {
        rolePermissions.set(permission.id, permission)
      })
    }

    const rolePermissionsList = Array.from(rolePermissions.values())

    // Combine all permissions
    const effectivePermissions = new Map<number, Permission>()
    directPermissions.forEach((p) => effectivePermissions.set(p.id, p))
    rolePermissionsList.forEach((p) => effectivePermissions.set(p.id, p))

    return {
      directPermissions,
      rolePermissions: rolePermissionsList,
      effectivePermissions: Array.from(effectivePermissions.values()),
      roles,
    }
  }

  /**
   * Check single permission for user
   */
  private async checkSinglePermission(
    userId: number,
    userPermissions: Permission[],
    permission: string,
    context?: string,
    resourceId?: number
  ): Promise<boolean> {
    // Parse permission string (resource.action.context)
    const parts = permission.split('.')
    const resource = parts[0]
    const action = parts[1]
    const permissionContext = parts[2] || context || 'any'

    const hasPermission = this.checkPermissionInList(
      userPermissions,
      resource,
      action,
      permissionContext
    )

    if (hasPermission) {
      return await this.checkContextualPermission(
        userId,
        resource,
        action,
        permissionContext,
        resourceId
      )
    }

    return false
  }

  /**
   * Load user permissions with optimized queries
   */
  private async loadUserPermissionsOptimized(userId: number): Promise<Permission[]> {
    const user = await this.usersRepository.findByIdWithActivePermissions(userId)

    if (!user) {
      return []
    }

    const allPermissions = new Map<number, Permission>()

    // Add direct user permissions
    user.permissions.forEach((permission) => {
      allPermissions.set(permission.id, permission)
    })

    // Add permissions from roles with inheritance
    for (const role of user.roles) {
      const effectivePermissions = await this.inheritanceService.getEffectivePermissions(role.slug)
      effectivePermissions.forEach((permission) => {
        allPermissions.set(permission.id, permission)
      })
    }

    return Array.from(allPermissions.values())
  }

  /**
   * Check if permission exists in list
   */
  private checkPermissionInList(
    permissions: Permission[],
    resource: string,
    action: string,
    context: string
  ): boolean {
    return permissions.some((permission) => {
      return (
        permission.resource === resource &&
        permission.action === action &&
        (permission.context === context || permission.context === 'any')
      )
    })
  }

  /**
   * Check contextual permission (ownership, etc.)
   */
  private async checkContextualPermission(
    userId: number,
    resource: string,
    action: string,
    context: string,
    resourceId?: number
  ): Promise<boolean> {
    if (context === IPermission.Contexts.ANY) {
      return true
    }

    if (context === IPermission.Contexts.OWN) {
      if (!resourceId) {
        return false
      }

      return this.ownershipService.checkOwnership({
        userId,
        resource,
        resourceId,
        action,
        context,
      })
    }

    // Team and department contexts are denied until a concrete domain policy is
    // registered. Unknown contextual permissions must never fail open.
    return false
  }
}
