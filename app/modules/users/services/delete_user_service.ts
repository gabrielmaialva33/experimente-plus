import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import UsersRepository from '#modules/users/repositories/users_repository'
import UserAdministrationPolicyService from '#modules/users/services/user_administration_policy_service'

@inject()
export default class DeleteUserService {
  constructor(
    private usersRepository: UsersRepository,
    private credentialInvalidationService: CredentialInvalidationService,
    private userAdministrationPolicyService: UserAdministrationPolicyService,
    private permissionCacheService: PermissionCacheService
  ) {}

  async run(actorUserId: number, userId: number): Promise<void> {
    await db.transaction(async (client) => {
      const lockedUsers = await this.usersRepository.lockActiveByIds([actorUserId, userId], client)
      const actor = lockedUsers.find((lockedUser) => lockedUser.id === actorUserId)
      const user = lockedUsers.find((lockedUser) => lockedUser.id === userId)

      if (!actor) {
        throw new ForbiddenException('The acting user is no longer active')
      }
      if (!user) {
        throw new NotFoundException('User not found')
      }

      await this.userAdministrationPolicyService.assertCanDelete(actorUserId, userId, client)

      user.useTransaction(client)
      user.is_deleted = true
      await user.save()

      await this.credentialInvalidationService.run(userId, client, DateTime.now())
    })

    await this.permissionCacheService.bumpEpochAfterCommittedMutation()
  }
}
