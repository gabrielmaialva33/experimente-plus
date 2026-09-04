import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import IRole from '#modules/roles/interfaces/role_interface'

/** Preserves at least one active platform Root across every account-removal path. */
export default class ActiveRootGuardService {
  async assertCanRemove(userId: number, client: TransactionClientContract): Promise<void> {
    const targetRootRole = await client
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('user_roles.user_id', userId)
      .where('roles.slug', IRole.Slugs.ROOT)
      .select('roles.id')
      .first()

    if (!targetRootRole) {
      return
    }

    // The role row is a common transaction mutex for deletions of different
    // Root users, whose individual user-row locks would otherwise be disjoint.
    await client
      .from('roles')
      .where('id', Number(targetRootRole.id))
      .select('id')
      .forUpdate()
      .first()

    const row = await client
      .from('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .where('users.is_deleted', false)
      .where('roles.slug', IRole.Slugs.ROOT)
      .countDistinct('users.id as total')
      .first()

    if (Number(row?.total ?? 0) <= 1) {
      throw new BadRequestException('The last active root user cannot be deleted')
    }
  }
}
