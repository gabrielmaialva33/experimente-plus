import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import IUser from '#modules/users/interfaces/user_interface'
import User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

@inject()
export default class EditUserService {
  constructor(
    private usersRepository: UsersRepository,
    private credentialInvalidationService: CredentialInvalidationService
  ) {}

  async run(userId: number, payload: IUser.EditPayload): Promise<User | null> {
    if (payload.password === undefined) {
      return this.usersRepository.update('id', userId, payload)
    }

    return db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveByIdForUpdate(userId, client)
      if (!user) {
        return null
      }

      user.useTransaction(client)
      user.merge(payload)
      await user.save()

      await this.credentialInvalidationService.run(userId, client, DateTime.now())
      return user
    })
  }
}
