import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import ForbiddenException from '#exceptions/forbidden_exception'
import NotFoundException from '#exceptions/not_found_exception'
import IUser from '#modules/users/interfaces/user_interface'
import User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'
import UserAdministrationPolicyService from '#modules/users/services/user_administration_policy_service'

@inject()
export default class EditUserService {
  constructor(
    private usersRepository: UsersRepository,
    private credentialInvalidationService: CredentialInvalidationService,
    private userAdministrationPolicyService: UserAdministrationPolicyService
  ) {}

  async run(actorUserId: number, userId: number, payload: IUser.EditPayload): Promise<User> {
    return db.transaction(async (client) => {
      const lockedUsers = await this.usersRepository.lockActiveByIds([actorUserId, userId], client)
      const actor = lockedUsers.find((lockedUser) => lockedUser.id === actorUserId)
      const user = lockedUsers.find((lockedUser) => lockedUser.id === userId)

      if (!actor) {
        throw new ForbiddenException('The acting user is no longer active')
      }
      if (!user) {
        throw new NotFoundException('User not found')
      }

      await this.userAdministrationPolicyService.assertCanUpdate(actorUserId, userId, client)

      user.useTransaction(client)
      user.merge(payload)
      await user.save()

      if (payload.password !== undefined) {
        await this.credentialInvalidationService.run(userId, client, DateTime.now())
      }

      return user
    })
  }
}
