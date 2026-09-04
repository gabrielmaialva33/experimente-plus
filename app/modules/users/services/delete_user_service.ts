import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import UsersRepository from '#modules/users/repositories/users_repository'

@inject()
export default class DeleteUserService {
  constructor(
    private usersRepository: UsersRepository,
    private credentialInvalidationService: CredentialInvalidationService
  ) {}

  async run(userId: number): Promise<void> {
    await db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveByIdForUpdate(userId, client)
      if (!user) {
        return
      }

      user.useTransaction(client)
      user.is_deleted = true
      await user.save()

      await this.credentialInvalidationService.run(userId, client, DateTime.now())
    })
  }
}
