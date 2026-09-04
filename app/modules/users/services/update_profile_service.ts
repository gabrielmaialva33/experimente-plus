import { inject } from '@adonisjs/core'
import { errors } from '@vinejs/vine'

import NotFoundException from '#exceptions/not_found_exception'
import type User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

export type UpdateProfilePayload = {
  full_name?: string
  username?: string
}

const USERNAME_UNIQUE_CONSTRAINT = 'users_username_unique'
const USERNAME_TAKEN_MESSAGE = 'The username has already been taken'

function isUsernameUniqueViolation(
  error: unknown
): error is Error & { code: '23505'; constraint: typeof USERNAME_UNIQUE_CONSTRAINT } {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === USERNAME_UNIQUE_CONSTRAINT
  )
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
      if (isUsernameUniqueViolation(error)) {
        throw new errors.E_VALIDATION_ERROR(
          [
            {
              field: 'username',
              rule: 'database.unique',
              message: USERNAME_TAKEN_MESSAGE,
            },
          ],
          { cause: error }
        )
      }

      throw error
    }

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }
}
