import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import IRole from '#modules/roles/interfaces/role_interface'
import RolesRepository from '#modules/roles/repositories/roles_repository'
import UsersRepository from '#modules/users/repositories/users_repository'

/** Preserves at least one active platform Root across every account-removal path. */
@inject()
export default class ActiveRootGuardService {
  constructor(
    private usersRepository: UsersRepository,
    private rolesRepository: RolesRepository
  ) {}

  async assertCanRemove(userId: number, client: TransactionClientContract): Promise<void> {
    const targetRootRoleId = await this.usersRepository.findAssignedRoleId(
      userId,
      IRole.Slugs.ROOT,
      client
    )

    if (targetRootRoleId === null) {
      return
    }

    // The role row is a common transaction mutex for deletions of different
    // Root users, whose individual user-row locks would otherwise be disjoint.
    await this.rolesRepository.lockRowById(targetRootRoleId, client)

    const activeRoots = await this.usersRepository.countActiveWithRole(IRole.Slugs.ROOT, client)

    if (activeRoots <= 1) {
      throw new BadRequestException('The last active root user cannot be deleted')
    }
  }
}
