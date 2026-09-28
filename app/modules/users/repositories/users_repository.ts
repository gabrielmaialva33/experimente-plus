import User from '#modules/users/models/user'

import type IUser from '#modules/users/interfaces/user_interface'
import LucidRepository from '#shared/lucid/lucid_repository'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { canonicalizeLoginIdentifier } from '#modules/users/utils/user_identity'

export function orderUserIdsForLock(userIds: number[]): number[] {
  return [...new Set(userIds)].sort((left, right) => left - right)
}

export default class UsersRepository
  extends LucidRepository<typeof User>
  implements IUser.Repository
{
  constructor() {
    super(User)
  }

  async verifyCredentials(uid: string, password: string): Promise<User> {
    return this.model.verifyCredentials(canonicalizeLoginIdentifier(uid), password)
  }

  async findActiveByIdForUpdate(
    userId: number,
    client: TransactionClientContract
  ): Promise<User | null> {
    return this.model
      .query({ client })
      .where('id', userId)
      .where('is_deleted', false)
      .forUpdate()
      .first()
  }

  /**
   * Lock active users in primary-key order. Administrative mutations use one
   * ordered query for actor and target so concurrent cross-user operations do
   * not acquire the same rows in opposite orders.
   */
  async lockActiveByIds(userIds: number[], client: TransactionClientContract): Promise<User[]> {
    const orderedIds = orderUserIdsForLock(userIds)

    return this.model
      .query({ client })
      .whereIn('id', orderedIds)
      .where('is_deleted', false)
      .orderBy('id', 'asc')
      .forUpdate()
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
   * Resolve the active owner of an email verification token HMAC. The caller
   * must lock the owner row and revalidate the hash before consuming it.
   */
  async findOwnerByEmailVerificationTokenHash(tokenHash: string): Promise<number | null> {
    const user = await this.model
      .query()
      .whereRaw("metadata->>'email_verification_token_hash' = ?", [tokenHash])
      .where('is_deleted', false)
      .select('id')
      .first()

    return user?.id ?? null
  }

  async findById(userId: number, client?: TransactionClientContract): Promise<User | null> {
    return this.model.query({ client }).where('id', userId).first()
  }

  async findActiveById(userId: number, client?: TransactionClientContract): Promise<User | null> {
    return this.model.query({ client }).where('id', userId).where('is_deleted', false).first()
  }

  /**
   * Lock the active user row, failing with Lucid's row-not-found error when it
   * does not exist.
   */
  async lockByIdOrFail(userId: number, client: TransactionClientContract): Promise<User> {
    return this.model.query({ client }).where('id', userId).forUpdate().firstOrFail()
  }

  /** The active user, only while they belong to the operation. */
  async findMemberOfTenant(
    userId: number,
    tenantId: number,
    client?: TransactionClientContract
  ): Promise<User | null> {
    return this.model
      .query({ client })
      .where('id', userId)
      .whereHas('tenants', (query) => query.where('tenants.id', tenantId))
      .first()
  }

  /** The active user with this (already lowercased) email, only while they belong to the operation. */
  async findMemberOfTenantByEmail(
    email: string,
    tenantId: number,
    client?: TransactionClientContract
  ): Promise<User | null> {
    return this.model
      .query({ client })
      .whereRaw('LOWER(email) = ?', [email])
      .whereHas('tenants', (query) => query.where('tenants.id', tenantId))
      .first()
  }

  /** Load the user's roles by name, with the pivot timestamps as `$extras`. */
  async loadRolesOrderedByName(user: User): Promise<void> {
    await user.load('roles', (query) => {
      query.select('id', 'name', 'description', 'slug', 'created_at', 'updated_at')
      query.orderBy('name')
    })
  }

  /**
   * Advance the credential generation unless it reached the ceiling. Returns
   * whether the row advanced; the generation is never wrapped around.
   */
  async advanceCredentialVersion(
    userId: number,
    ceiling: number,
    client: TransactionClientContract
  ): Promise<boolean> {
    const advanced = await client.rawQuery<{ rows: Array<{ credential_version: number }> }>(
      `UPDATE users
       SET credential_version = credential_version + 1
       WHERE id = ? AND credential_version < ?
       RETURNING credential_version`,
      [userId, ceiling]
    )

    return advanced.rows.length === 1
  }

  /**
   * Try to take the transaction-scoped advisory lock `(namespace, name)`
   * without waiting. Returns whether the lock was acquired.
   */
  async tryAdvisoryTransactionLock(
    namespace: number,
    name: string,
    client: TransactionClientContract
  ): Promise<boolean> {
    const lock = await client.rawQuery<{ rows: Array<{ acquired: boolean }> }>(
      'SELECT pg_try_advisory_xact_lock(CAST(? AS integer), hashtext(?)) AS acquired',
      [namespace, name]
    )
    return lock.rows.length === 1 && lock.rows[0].acquired === true
  }

  /**
   * Lock the given user rows in primary-key order, soft-deleted ones included,
   * and read their stored password hashes. The rest of the calling transaction
   * waits at most 2s for a lock and 5s for a statement.
   */
  async lockPasswordHashesByIds(
    userIds: number[],
    client: TransactionClientContract
  ): Promise<Array<{ id: number; password: string }>> {
    await client.rawQuery("SET LOCAL lock_timeout TO '2s'")
    await client.rawQuery("SET LOCAL statement_timeout TO '5s'")

    return client
      .from('users')
      .whereIn('id', userIds)
      .orderBy('id', 'asc')
      .forUpdate()
      .select('id', 'password')
  }

  /** Role assignments of the given users, by user and then role id. */
  async listRoleAssignments(
    userIds: number[],
    client: TransactionClientContract
  ): Promise<Array<{ userId: number; roleId: number }>> {
    const rows = await client
      .from('user_roles')
      .whereIn('user_id', userIds)
      .orderBy('user_id', 'asc')
      .orderBy('role_id', 'asc')
      .select('user_id', 'role_id')

    return rows.map((row) => ({
      userId: Number(row.user_id),
      roleId: Number(row.role_id),
    }))
  }

  /** Role slugs held by the given users, by user and then by role id or slug. */
  async listRoleSlugs(
    userIds: number[],
    client: TransactionClientContract,
    roleOrder: 'id' | 'slug'
  ): Promise<Array<{ userId: number; slug: string }>> {
    const rows = await client
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .whereIn('user_roles.user_id', userIds)
      .orderBy('user_roles.user_id', 'asc')
      .orderBy(roleOrder === 'id' ? 'roles.id' : 'roles.slug', 'asc')
      .select('user_roles.user_id', 'roles.slug')

    return rows.map((row) => ({
      userId: Number(row.user_id),
      slug: String(row.slug),
    }))
  }

  /** Id of the role with this slug when the user holds it. */
  async findAssignedRoleId(
    userId: number,
    slug: string,
    client: TransactionClientContract
  ): Promise<number | null> {
    const role = await client
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', userId)
      .where('roles.slug', slug)
      .select('roles.id')
      .first()

    return role ? Number(role.id) : null
  }

  /** Number of distinct active users holding the role with this slug. */
  async countActiveWithRole(slug: string, client: TransactionClientContract): Promise<number> {
    const row = await client
      .from('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('users.is_deleted', false)
      .where('roles.slug', slug)
      .countDistinct('users.id as total')
      .first()

    return Number(row?.total ?? 0)
  }

  /** Insert role assignments for a user that holds none of them yet (plain pivot insert). */
  async insertRoleAssignments(
    user: User,
    roleIds: number[],
    client: TransactionClientContract
  ): Promise<void> {
    await user.related('roles').attach(roleIds, client)
  }

  /** Attach roles without detaching the ones the user already holds. */
  async attachRoles(
    user: User,
    roleIds: number[],
    client: TransactionClientContract
  ): Promise<void> {
    await user.related('roles').sync(roleIds, false, client)
  }

  /** Replace the user's direct permissions with the given pivot map. */
  async syncPermissions(
    user: User,
    permissions: IUser.PermissionPivotMap,
    client: TransactionClientContract
  ): Promise<void> {
    await user.related('permissions').sync(permissions, undefined, client)
  }

  /** Attach or update direct permissions without detaching the others. */
  async attachPermissions(
    user: User,
    permissions: IUser.PermissionPivotMap,
    client: TransactionClientContract
  ): Promise<void> {
    await user.related('permissions').sync(permissions, false, client)
  }

  async detachPermissions(
    user: User,
    permissionIds: number[],
    client: TransactionClientContract
  ): Promise<void> {
    await user.related('permissions').detach(permissionIds, client)
  }

  async detachAllRoles(userId: number, client: TransactionClientContract): Promise<void> {
    await client.from('user_roles').where('user_id', userId).delete()
  }

  async detachAllPermissions(userId: number, client: TransactionClientContract): Promise<void> {
    await client.from('user_permissions').where('user_id', userId).delete()
  }
}
