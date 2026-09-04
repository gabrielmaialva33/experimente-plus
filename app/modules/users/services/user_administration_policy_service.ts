import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import ForbiddenException from '#exceptions/forbidden_exception'
import IRole from '#modules/roles/interfaces/role_interface'
import ActiveRootGuardService from '#modules/users/services/active_root_guard_service'

type LoadedRoles = {
  actorRoles: string[]
  targetRoles: string[]
}

/** Enforces the canonical platform-role hierarchy after actor and target are locked. */
@inject()
export default class UserAdministrationPolicyService {
  constructor(private activeRootGuardService: ActiveRootGuardService) {}

  /**
   * Administrative profile/password updates may target the acting account.
   * The payload cannot change roles, email or username; those have separate
   * boundaries.
   */
  async assertCanUpdate(
    actorUserId: number,
    targetUserId: number,
    client: TransactionClientContract
  ): Promise<void> {
    await this.authorizeManagement(actorUserId, targetUserId, client, true)
  }

  /** Administrative deletion never doubles as the dedicated self-delete flow. */
  async assertCanDelete(
    actorUserId: number,
    targetUserId: number,
    client: TransactionClientContract
  ): Promise<void> {
    const { targetRoles } = await this.authorizeManagement(actorUserId, targetUserId, client, false)

    if (targetRoles.includes(IRole.Slugs.ROOT)) {
      await this.activeRootGuardService.assertCanRemove(targetUserId, client)
    }
  }

  /**
   * Role assignment is additive but may never target the actor. This keeps an
   * authenticated administrator from changing their own authorization set.
   */
  async assertCanAssignRoles(
    actorUserId: number,
    targetUserId: number,
    assignedRoleSlugs: string[],
    client: TransactionClientContract
  ): Promise<void> {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException('You cannot assign platform roles to yourself')
    }

    const { actorRoles, targetRoles } = await this.loadRoles(actorUserId, targetUserId, client)
    this.assertPlatformAdministrator(actorRoles)
    this.assertCanonicalRoles(targetRoles)
    this.assertCanonicalRoles(assignedRoleSlugs)

    if (assignedRoleSlugs.length === 0) {
      throw new BadRequestException('At least one platform role must be provided')
    }

    if (
      !this.dominatesEvery(actorRoles, targetRoles, true) ||
      !this.dominatesEvery(actorRoles, assignedRoleSlugs, true)
    ) {
      throw new ForbiddenException(
        'You cannot assign an equal or higher platform role to this user'
      )
    }
  }

  private async authorizeManagement(
    actorUserId: number,
    targetUserId: number,
    client: TransactionClientContract,
    allowSelf: boolean
  ): Promise<LoadedRoles> {
    const roles = await this.loadRoles(actorUserId, targetUserId, client)
    this.assertPlatformAdministrator(roles.actorRoles)
    this.assertCanonicalRoles(roles.targetRoles)

    if (actorUserId === targetUserId) {
      if (allowSelf) {
        return roles
      }

      throw new ForbiddenException('Use the account deletion flow to delete your own account')
    }

    if (!this.dominatesEvery(roles.actorRoles, roles.targetRoles, true)) {
      throw new ForbiddenException('You cannot manage a user with an equal or higher platform role')
    }

    return roles
  }

  private async loadRoles(
    actorUserId: number,
    targetUserId: number,
    client: TransactionClientContract
  ): Promise<LoadedRoles> {
    const rows = await client
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .whereIn('user_roles.user_id', [...new Set([actorUserId, targetUserId])])
      .orderBy('user_roles.user_id', 'asc')
      .orderBy('roles.id', 'asc')
      .select('user_roles.user_id', 'roles.slug')

    return {
      actorRoles: rows
        .filter((row) => Number(row.user_id) === actorUserId)
        .map((row) => String(row.slug)),
      targetRoles: rows
        .filter((row) => Number(row.user_id) === targetUserId)
        .map((row) => String(row.slug)),
    }
  }

  private assertPlatformAdministrator(roles: string[]): void {
    if (!IRole.isPlatformAdministrator(roles)) {
      throw new ForbiddenException('The acting user is no longer a platform administrator')
    }
  }

  private assertCanonicalRoles(roles: string[]): void {
    if (roles.some((role) => !IRole.isCanonicalSlug(role))) {
      throw new ForbiddenException('A non-canonical platform role blocks this operation')
    }
  }

  private dominatesEvery(
    actorRoles: string[],
    targetRoles: string[],
    allowRootPeer = false
  ): boolean {
    return targetRoles.every((targetRole) =>
      actorRoles.some(
        (actorRole) =>
          IRole.dominates(actorRole, targetRole) ||
          (allowRootPeer && actorRole === IRole.Slugs.ROOT && targetRole === IRole.Slugs.ROOT)
      )
    )
  }
}
