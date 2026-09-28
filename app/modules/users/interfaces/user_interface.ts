import type LucidRepositoryInterface from '#shared/lucid/lucid_repository_interface'
import type User from '#modules/users/models/user'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

namespace IUser {
  export interface Repository extends LucidRepositoryInterface<typeof User> {
    /**
     * Verify user credentials and return the user
     * @param uid
     * @param password
     */
    verifyCredentials(uid: string, password: string): Promise<User>

    findActiveByIdForUpdate(userId: number, client: TransactionClientContract): Promise<User | null>

    lockActiveByIds(userIds: number[], client: TransactionClientContract): Promise<User[]>

    findByIdWithPermissionsAndRoles(userId: number): Promise<User | null>

    findByIdWithPermissionsAndRolesOrFail(userId: number): Promise<User>

    findByIdWithActivePermissions(userId: number): Promise<User | null>

    findCreatedSince(startSql: string): Promise<User[]>

    findCreatedSinceForTenant(startSql: string, tenantId: number): Promise<User[]>

    listRecentWithRoles(limit: number): Promise<User[]>

    listRecentWithRolesForTenant(limit: number, tenantId: number): Promise<User[]>

    countForTenant(tenantId: number): Promise<number>

    findOwnerByEmailVerificationTokenHash(tokenHash: string): Promise<number | null>

    findActiveById(userId: number, client?: TransactionClientContract): Promise<User | null>

    lockByIdOrFail(userId: number, client: TransactionClientContract): Promise<User>

    findMemberOfTenant(
      userId: number,
      tenantId: number,
      client?: TransactionClientContract
    ): Promise<User | null>

    findMemberOfTenantByEmail(
      email: string,
      tenantId: number,
      client?: TransactionClientContract
    ): Promise<User | null>

    loadRolesOrderedByName(user: User): Promise<void>

    advanceCredentialVersion(
      userId: number,
      ceiling: number,
      client: TransactionClientContract
    ): Promise<boolean>

    lockPasswordHashesByIds(
      userIds: number[],
      client: TransactionClientContract
    ): Promise<Array<{ id: number; password: string }>>

    listRoleAssignments(
      userIds: number[],
      client: TransactionClientContract
    ): Promise<Array<{ userId: number; roleId: number }>>

    listRoleSlugs(
      userIds: number[],
      client: TransactionClientContract,
      roleOrder: 'id' | 'slug'
    ): Promise<Array<{ userId: number; slug: string }>>

    findAssignedRoleId(
      userId: number,
      slug: string,
      client: TransactionClientContract
    ): Promise<number | null>

    countActiveWithRole(slug: string, client: TransactionClientContract): Promise<number>

    insertRoleAssignments(
      user: User,
      roleIds: number[],
      client: TransactionClientContract
    ): Promise<void>

    attachRoles(user: User, roleIds: number[], client: TransactionClientContract): Promise<void>

    syncPermissions(
      user: User,
      permissions: PermissionPivotMap,
      client: TransactionClientContract
    ): Promise<void>

    attachPermissions(
      user: User,
      permissions: PermissionPivotMap,
      client: TransactionClientContract
    ): Promise<void>

    detachPermissions(
      user: User,
      permissionIds: number[],
      client: TransactionClientContract
    ): Promise<void>

    detachAllRoles(userId: number, client: TransactionClientContract): Promise<void>

    detachAllPermissions(userId: number, client: TransactionClientContract): Promise<void>
  }

  export interface PermissionPivotData {
    granted: boolean
    expires_at: string | null
  }

  export type PermissionPivotMap = Record<number, PermissionPivotData>

  export interface CreatePayload {
    full_name: string
    email: string
    username?: string
    password: string
  }

  export interface EditPayload {
    full_name?: string
    password?: string
  }
}

export default IUser
