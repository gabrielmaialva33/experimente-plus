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
