import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import FreshPlatformPermissionService from '#modules/permissions/services/fresh_platform_permission_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

type LockedRoleContext = {
  actorRoles: IRole.Slugs[]
  targetRoles: IRole.Slugs[]
}

/**
 * Transactional authorization boundary for platform permission mutations.
 *
 * User rows are locked before role rows, and both sets are locked in primary
 * key order. This serializes role/direct-permission revocation with the fresh
 * authorization check and prevents a cached middleware decision from being
 * the final authority for a privileged write.
 */
@inject()
export default class PermissionAdministrationPolicyService {
  constructor(
    private usersRepository: UsersRepository,
    private freshPlatformPermissionService: FreshPlatformPermissionService
  ) {}

  async lockAndAuthorizePermissionCreation(
    actorUserId: number,
    client: TransactionClientContract
  ): Promise<void> {
    const [actor] = await this.usersRepository.lockActiveByIds([actorUserId], client)
    if (!actor) {
      throw new ForbiddenException('The acting user is no longer active')
    }

    const assignments = await this.loadRoleAssignments([actorUserId], client)
    const roles = await this.lockRoles(
      assignments.map((assignment) => assignment.roleId),
      client
    )
    const roleById = new Map(roles.map((role) => [role.id, role]))
    const actorRoles = this.resolveCanonicalRoles(assignments, actorUserId, roleById)

    await this.freshPlatformPermissionService.assertGranted(
      actorUserId,
      actorRoles,
      {
        resource: IPermission.Resources.PERMISSIONS,
        action: IPermission.Actions.CREATE,
      },
      client
    )
  }

  async lockAndAuthorizeRoleMutation(
    actorUserId: number,
    targetRoleId: number,
    client: TransactionClientContract
  ): Promise<Role> {
    const [actor] = await this.usersRepository.lockActiveByIds([actorUserId], client)
    if (!actor) {
      throw new ForbiddenException('The acting user is no longer active')
    }

    const assignments = await this.loadRoleAssignments([actorUserId], client)
    const actorRoleIds = assignments.map((assignment) => assignment.roleId)
    const roles = await this.lockRoles([...actorRoleIds, targetRoleId], client)
    const roleById = new Map(roles.map((role) => [role.id, role]))
    const targetRole = roleById.get(targetRoleId)

    if (!targetRole) {
      throw new NotFoundException('Role not found')
    }

    const actorRoles = this.resolveCanonicalRoles(assignments, actorUserId, roleById)
    await this.freshPlatformPermissionService.assertGranted(
      actorUserId,
      actorRoles,
      {
        resource: IPermission.Resources.PERMISSIONS,
        action: IPermission.Actions.UPDATE,
      },
      client
    )

    if (!IRole.isCanonicalSlug(targetRole.slug) || targetRole.slug === IRole.Slugs.ROOT) {
      throw new ForbiddenException('The target role cannot have its permissions changed')
    }

    if (!actorRoles.some((actorRole) => IRole.dominates(actorRole, targetRole.slug))) {
      throw new ForbiddenException(
        'You cannot change permissions for an equal or higher platform role'
      )
    }

    return targetRole
  }

  async lockAndAuthorizeUserMutation(
    actorUserId: number,
    targetUserId: number,
    client: TransactionClientContract
  ): Promise<User> {
    const users = await this.usersRepository.lockActiveByIds([actorUserId, targetUserId], client)
    const actor = users.find((user) => user.id === actorUserId)
    const target = users.find((user) => user.id === targetUserId)

    if (!actor) {
      throw new ForbiddenException('The acting user is no longer active')
    }
    if (!target) {
      throw new NotFoundException('User not found')
    }
    if (actorUserId === targetUserId) {
      throw new ForbiddenException('You cannot change your own direct permissions')
    }

    const assignments = await this.loadRoleAssignments([actorUserId, targetUserId], client)
    const roles = await this.lockRoles(
      assignments.map((assignment) => assignment.roleId),
      client
    )
    const roleById = new Map(roles.map((role) => [role.id, role]))
    const actorRoles = this.resolveCanonicalRoles(assignments, actorUserId, roleById)
    const targetRoles = this.resolveCanonicalRoles(assignments, targetUserId, roleById)

    await this.freshPlatformPermissionService.assertGranted(
      actorUserId,
      actorRoles,
      {
        resource: IPermission.Resources.PERMISSIONS,
        action: IPermission.Actions.UPDATE,
      },
      client
    )

    if (
      targetRoles.some((role) => role === IRole.Slugs.ROOT) ||
      !targetRoles.every((targetRole) =>
        actorRoles.some((actorRole) => IRole.dominates(actorRole, targetRole))
      )
    ) {
      throw new ForbiddenException(
        'You cannot change direct permissions for an equal or higher platform user'
      )
    }

    return target
  }

  private async loadRoleAssignments(
    userIds: number[],
    client: TransactionClientContract
  ): Promise<Array<{ userId: number; roleId: number }>> {
    const rows = await client
      .from('user_roles')
      .whereIn(
        'user_id',
        [...new Set(userIds)].sort((left, right) => left - right)
      )
      .orderBy('user_id', 'asc')
      .orderBy('role_id', 'asc')
      .select('user_id', 'role_id')

    return rows.map((row) => ({
      userId: Number(row.user_id),
      roleId: Number(row.role_id),
    }))
  }

  private async lockRoles(roleIds: number[], client: TransactionClientContract): Promise<Role[]> {
    const uniqueRoleIds = [...new Set(roleIds)].sort((left, right) => left - right)
    if (uniqueRoleIds.length === 0) {
      return []
    }

    return Role.query({ client }).whereIn('id', uniqueRoleIds).orderBy('id', 'asc').forUpdate()
  }

  private resolveCanonicalRoles(
    assignments: Array<{ userId: number; roleId: number }>,
    userId: number,
    roleById: Map<number, Role>
  ): IRole.Slugs[] {
    const roles = assignments
      .filter((assignment) => assignment.userId === userId)
      .map((assignment) => roleById.get(assignment.roleId)?.slug)

    if (roles.some((role) => !role || !IRole.isCanonicalSlug(role))) {
      throw new ForbiddenException('A non-canonical platform role blocks this operation')
    }

    return roles as IRole.Slugs[]
  }
}
