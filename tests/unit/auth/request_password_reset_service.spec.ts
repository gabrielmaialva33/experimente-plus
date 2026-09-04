import { test } from '@japa/runner'

import RequestPasswordResetService from '#modules/auth/services/request_password_reset_service'
import type PasswordResetTokenService from '#modules/auth/services/password_reset_token_service'
import type UsersRepository from '#modules/users/repositories/users_repository'

class UnexpectedTransactionalFailureService extends RequestPasswordResetService {
  constructor(
    usersRepository: UsersRepository,
    passwordResetTokenService: PasswordResetTokenService,
    private readonly failure: Error
  ) {
    super(usersRepository, passwordResetTokenService)
  }

  protected async issueAndDeliver(): Promise<void> {
    throw this.failure
  }
}

test.group('RequestPasswordResetService', () => {
  test('rethrows unexpected transactional failures by identity', async ({ assert }) => {
    const unexpectedFailure = new Error('unexpected reset token persistence failure')
    const usersRepository = {
      findBy: async () => ({ id: 42 }),
    } as unknown as UsersRepository
    const passwordResetTokenService = {} as PasswordResetTokenService
    const service = new UnexpectedTransactionalFailureService(
      usersRepository,
      passwordResetTokenService,
      unexpectedFailure
    )

    let failure: unknown
    try {
      await service.run('person@example.com')
    } catch (error) {
      failure = error
    }

    assert.strictEqual(failure, unexpectedFailure)
  })
})
