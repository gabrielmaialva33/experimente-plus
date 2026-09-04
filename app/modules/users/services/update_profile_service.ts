import { inject } from '@adonisjs/core'
import NotFoundException from '#exceptions/not_found_exception'
import type User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'
import { mapUserUniqueConstraintError } from '#modules/users/utils/user_unique_constraint_error'

export type UpdateProfilePayload = {
  full_name?: string
  username?: string | null
}

/** Updates only the authenticated user's allowlisted self-service fields. */
@inject()
export default class UpdateProfileService {
  constructor(private usersRepository: UsersRepository) {}

  async run(userId: number, payload: UpdateProfilePayload): Promise<User> {
    let user: User | null
    try {
      user = await this.usersRepository.update('id', userId, payload)
    } catch (error) {
      throw mapUserUniqueConstraintError(error, ['username'])
    }

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }
}
