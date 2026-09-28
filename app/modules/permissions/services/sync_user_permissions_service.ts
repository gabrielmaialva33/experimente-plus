import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IUser from '#modules/users/interfaces/user_interface'
import {
  PERMISSION_MUTATION_MAX_ITEMS,
  POSTGRES_INTEGER_MAX,
} from '#modules/permissions/permission_limits'
import PermissionRepository from '#modules/permissions/repositories/permission_repository'
import PermissionAdministrationPolicyService from '#modules/permissions/services/permission_administration_policy_service'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import UsersRepository from '#modules/users/repositories/users_repository'

interface UserPermissionData {
  permission_id: number
  granted?: boolean
  expires_at?: string | null
}

type UserPermissionMutation = {
  actorUserId: number
  userId: number
  permissions: UserPermissionData[]
}

type SingleUserPermissionMutation = {
  actorUserId: number
  userId: number
  permissionId: number
  granted?: boolean
  expiresAt?: string | null
}

@inject()
export default class SyncUserPermissionsService {
  constructor(
    private permissionCacheService: PermissionCacheService,
    private permissionAdministrationPolicyService: PermissionAdministrationPolicyService,
    private permissionRepository: PermissionRepository,
    private usersRepository: UsersRepository
  ) {}

  async handle(input: UserPermissionMutation): Promise<void> {
    this.assertMutationInput(input)
    const syncData = this.toSyncData(input.permissions)

    await db.transaction(async (client) => {
      const user = await this.permissionAdministrationPolicyService.lockAndAuthorizeUserMutation(
        input.actorUserId,
        input.userId,
        client
      )
      await this.assertPermissionsExist(
        input.permissions.map((permission) => permission.permission_id),
        client
      )
      await this.usersRepository.syncPermissions(user, syncData, client)
    })

    await this.permissionCacheService.bumpEpochAfterCommittedMutation()
  }

  async attachPermission(input: SingleUserPermissionMutation): Promise<void> {
    this.assertSingleMutationInput(input)
    const pivotData: IUser.PermissionPivotData = {
      granted: input.granted ?? true,
      expires_at: input.expiresAt ? this.parseExpiration(input.expiresAt).toSQL() : null,
    }

    await db.transaction(async (client) => {
      const user = await this.permissionAdministrationPolicyService.lockAndAuthorizeUserMutation(
        input.actorUserId,
        input.userId,
        client
      )
      await this.assertPermissionsExist([input.permissionId], client)
      await this.usersRepository.attachPermissions(
        user,
        { [input.permissionId]: pivotData },
        client
      )
    })

    await this.permissionCacheService.bumpEpochAfterCommittedMutation()
  }

  async revokePermission(input: Omit<SingleUserPermissionMutation, 'granted' | 'expiresAt'>) {
    this.assertSingleMutationInput(input)

    await db.transaction(async (client) => {
      const user = await this.permissionAdministrationPolicyService.lockAndAuthorizeUserMutation(
        input.actorUserId,
        input.userId,
        client
      )
      await this.assertPermissionsExist([input.permissionId], client)
      await this.usersRepository.detachPermissions(user, [input.permissionId], client)
    })

    await this.permissionCacheService.bumpEpochAfterCommittedMutation()
  }

  private toSyncData(permissions: UserPermissionData[]): IUser.PermissionPivotMap {
    return Object.fromEntries(
      permissions.map((permission) => [
        permission.permission_id,
        {
          granted: permission.granted ?? true,
          expires_at: permission.expires_at
            ? this.parseExpiration(permission.expires_at).toSQL()
            : null,
        },
      ])
    )
  }

  private assertMutationInput(input: UserPermissionMutation): void {
    if (!this.isPostgresId(input.actorUserId) || !this.isPostgresId(input.userId)) {
      throw new BadRequestException('Actor and user ids must be positive int4 values')
    }
    if (input.permissions.length > PERMISSION_MUTATION_MAX_ITEMS) {
      throw new BadRequestException(
        `No more than ${PERMISSION_MUTATION_MAX_ITEMS} permissions may be changed at once`
      )
    }

    const permissionIds = input.permissions.map((permission) => permission.permission_id)
    if (
      permissionIds.some((permissionId) => !this.isPostgresId(permissionId)) ||
      new Set(permissionIds).size !== permissionIds.length
    ) {
      throw new BadRequestException('Permission ids must be distinct positive int4 values')
    }
  }

  private assertSingleMutationInput(
    input: Omit<SingleUserPermissionMutation, 'granted' | 'expiresAt'>
  ): void {
    if (
      !this.isPostgresId(input.actorUserId) ||
      !this.isPostgresId(input.userId) ||
      !this.isPostgresId(input.permissionId)
    ) {
      throw new BadRequestException('Actor, user and permission ids must be positive int4 values')
    }
  }

  private async assertPermissionsExist(
    permissionIds: number[],
    client: TransactionClientContract
  ): Promise<void> {
    if (permissionIds.length === 0) {
      return
    }

    const existingIds = await this.permissionRepository.findExistingIds(permissionIds, client)

    if (existingIds.length !== permissionIds.length) {
      throw new NotFoundException('Permission not found')
    }
  }

  private parseExpiration(value: string): DateTime {
    const expiresAt = DateTime.fromISO(value, { setZone: true })
    if (!expiresAt.isValid) {
      throw new BadRequestException('expires_at must be a valid ISO date')
    }

    return expiresAt
  }

  private isPostgresId(value: number): boolean {
    return Number.isInteger(value) && value >= 1 && value <= POSTGRES_INTEGER_MAX
  }
}
