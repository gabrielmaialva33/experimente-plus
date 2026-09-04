import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import FreshPlatformPermissionService from '#modules/permissions/services/fresh_platform_permission_service'
import Role from '#modules/roles/models/role'
import { POSTGRES_ROLE_INTEGER_MAX, ROLE_ASSIGNMENT_MAX_ITEMS } from '#modules/roles/role_limits'
import UsersRepository from '#modules/users/repositories/users_repository'
import UserAdministrationPolicyService from '#modules/users/services/user_administration_policy_service'

type AttachRolesRequest = {
  actorUserId: number
  userId: number
  roleIds: number[]
}

/**
 * Attaches roles without replacing the user's existing assignments. The legacy
 * class name is kept to avoid churn in callers, but the endpoint semantics are
 * now truly additive.
 */
@inject()
export default class SyncRolesService {
  constructor(
    private usersRepository: UsersRepository,
    private permissionCacheService: PermissionCacheService,
    private userAdministrationPolicyService: UserAdministrationPolicyService,
    private freshPlatformPermissionService: FreshPlatformPermissionService
  ) {}

  async run(input: AttachRolesRequest): Promise<void> {
    this.assertValidInput(input)

    await db.transaction(async (client) => {
      const lockedUsers = await this.usersRepository.lockActiveByIds(
        [input.actorUserId, input.userId],
        client
      )
      const actor = lockedUsers.find((lockedUser) => lockedUser.id === input.actorUserId)
      const user = lockedUsers.find((lockedUser) => lockedUser.id === input.userId)

      if (!actor) {
        throw new ForbiddenException('The acting user is no longer active')
      }
      if (!user) {
        throw new NotFoundException('User not found')
      }

      const assignments = await client
        .from('user_roles')
        .whereIn(
          'user_id',
          [...new Set([input.actorUserId, input.userId])].sort((a, b) => a - b)
        )
        .orderBy('user_id', 'asc')
        .orderBy('role_id', 'asc')
        .select('user_id', 'role_id')
      const lockedRoleIds = [
        ...new Set([
          ...input.roleIds,
          ...assignments.map((assignment) => Number(assignment.role_id)),
        ]),
      ].sort((a, b) => a - b)
      const roles = await Role.query({ client })
        .whereIn('id', lockedRoleIds)
        .orderBy('id', 'asc')
        .forUpdate()
      const roleById = new Map(roles.map((role) => [role.id, role]))
      const assignedRoles = input.roleIds.map((roleId) => roleById.get(roleId))

      if (assignedRoles.some((role) => !role)) {
        throw new NotFoundException('Role not found')
      }

      const actorRoles = assignments
        .filter((assignment) => Number(assignment.user_id) === input.actorUserId)
        .map((assignment) => roleById.get(Number(assignment.role_id))?.slug ?? '')

      await this.userAdministrationPolicyService.assertCanAssignRoles(
        input.actorUserId,
        input.userId,
        assignedRoles.map((role) => String(role!.slug)),
        client
      )
      await this.freshPlatformPermissionService.assertGranted(
        input.actorUserId,
        actorRoles,
        {
          resource: IPermission.Resources.ROLES,
          action: IPermission.Actions.ASSIGN,
        },
        client
      )

      await user.related('roles').sync(input.roleIds, false, client)
    })

    await this.permissionCacheService.bumpEpochAfterCommittedMutation()
  }

  private assertValidInput(input: AttachRolesRequest): void {
    if (!this.isPostgresId(input.actorUserId) || !this.isPostgresId(input.userId)) {
      throw new BadRequestException('Actor and user ids must be positive int4 values')
    }
    if (
      !Array.isArray(input.roleIds) ||
      input.roleIds.length < 1 ||
      input.roleIds.length > ROLE_ASSIGNMENT_MAX_ITEMS
    ) {
      throw new BadRequestException(
        `Between 1 and ${ROLE_ASSIGNMENT_MAX_ITEMS} roles must be provided`
      )
    }
    if (
      input.roleIds.some((roleId) => !this.isPostgresId(roleId)) ||
      new Set(input.roleIds).size !== input.roleIds.length
    ) {
      throw new BadRequestException('Role ids must be distinct positive int4 values')
    }
  }

  private isPostgresId(value: number): boolean {
    return Number.isInteger(value) && value >= 1 && value <= POSTGRES_ROLE_INTEGER_MAX
  }
}
