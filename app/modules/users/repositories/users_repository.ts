import User from '#modules/users/models/user'

import type IUser from '#modules/users/interfaces/user_interface'
import LucidRepository from '#shared/lucid/lucid_repository'

export default class UsersRepository
  extends LucidRepository<typeof User>
  implements IUser.Repository
{
  constructor() {
    super(User)
  }

  async verifyCredentials(uid: string, password: string): Promise<User> {
    return this.model.verifyCredentials(uid, password)
  }

  /**
   * Load a user with direct permissions and roles (with their permissions)
   * preloaded. Returns null when not found.
   */
  async findByIdWithPermissionsAndRoles(userId: number): Promise<User | null> {
    return this.model
      .query()
      .where('id', userId)
      .preload('permissions')
      .preload('roles', (query) => {
        query.preload('permissions')
      })
      .first()
  }

  /**
   * Same as findByIdWithPermissionsAndRoles but throws when the user is missing
   * (mirrors the firstOrFail semantics used by the permission checks).
   */
  async findByIdWithPermissionsAndRolesOrFail(userId: number): Promise<User> {
    return this.model
      .query()
      .where('id', userId)
      .preload('roles', (query) => {
        query.preload('permissions')
      })
      .preload('permissions')
      .firstOrFail()
  }

  /**
   * Load a user with only the granted, non-expired direct permissions plus the
   * roles (with their permissions) preloaded. Used by the optimized permission
   * resolution path.
   */
  async findByIdWithActivePermissions(userId: number): Promise<User | null> {
    const user = await this.model.query().where('id', userId).first()
    if (!user) {
      return null
    }

    // Load the relations sequentially. Lucid may execute sibling preloads in
    // parallel, which is unsafe when tests pin every query to one transaction
    // client and is deprecated by pg 8.23+.
    await user.load('permissions', (query) => {
      query.where('granted', true)
      query.where((subQuery) => {
        subQuery.whereNull('expires_at').orWhere('expires_at', '>', new Date())
      })
    })
    await user.load('roles')
    for (const role of user.roles) {
      await role.load('permissions')
    }

    return user
  }

  /**
   * Users created on or after the given SQL timestamp, selecting only the
   * created_at column (used to build the dashboard signup series).
   */
  async findCreatedSince(startSql: string): Promise<User[]> {
    return this.model.query().where('created_at', '>=', startSql).select('created_at')
  }

  async findCreatedSinceForTenant(startSql: string, tenantId: number): Promise<User[]> {
    return this.model
      .query()
      .where('created_at', '>=', startSql)
      .whereHas('tenants', (query) => query.where('tenants.id', tenantId))
      .select('created_at')
  }

  /**
   * Most recently created users with their roles preloaded.
   */
  async listRecentWithRoles(limit: number): Promise<User[]> {
    return this.model.query().preload('roles').orderBy('created_at', 'desc').limit(limit)
  }

  async listRecentWithRolesForTenant(limit: number, tenantId: number): Promise<User[]> {
    return this.model
      .query()
      .whereHas('tenants', (query) => query.where('tenants.id', tenantId))
      .preload('roles')
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  async countForTenant(tenantId: number): Promise<number> {
    const rows = await this.model
      .query()
      .whereHas('tenants', (query) => query.where('tenants.id', tenantId))
      .count('* as total')

    return Number(rows[0].$extras.total)
  }

  /**
   * Find a user by the HMAC of the email verification token stored in metadata,
   * ignoring soft-deleted records. Raw tokens are never persisted.
   */
  async findByEmailVerificationTokenHash(tokenHash: string): Promise<User | null> {
    return this.model
      .query()
      .whereRaw("metadata->>'email_verification_token_hash' = ?", [tokenHash])
      .where('is_deleted', false)
      .first()
  }

  /**
   * Replace the user's direct permissions with the given pivot data.
   */
  async syncPermissions(user: User, syncData: IUser.PermissionPivotMap): Promise<void> {
    await user.related('permissions').sync(syncData)
  }

  /**
   * Return the pivot row for a user/permission pair, or null when not attached.
   */
  async findPermissionPivot(
    user: User,
    permissionId: number
  ): Promise<Record<string, unknown> | null> {
    return user.related('permissions').pivotQuery().where('permission_id', permissionId).first()
  }

  /**
   * Update the pivot row for an already attached permission.
   */
  async updatePermissionPivot(
    user: User,
    permissionId: number,
    pivotData: IUser.PermissionPivotData
  ): Promise<void> {
    await user
      .related('permissions')
      .pivotQuery()
      .where('permission_id', permissionId)
      .update(pivotData)
  }

  /**
   * Attach a single permission to the user with the given pivot data.
   */
  async attachPermission(
    user: User,
    permissionId: number,
    pivotData: IUser.PermissionPivotData
  ): Promise<void> {
    await user.related('permissions').attach({
      [permissionId]: pivotData,
    })
  }

  /**
   * Detach the given permissions from the user.
   */
  async detachPermissions(user: User, permissionIds: number[]): Promise<void> {
    await user.related('permissions').detach(permissionIds)
  }
}
