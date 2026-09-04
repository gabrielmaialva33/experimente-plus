import { test } from '@japa/runner'

import EmailVerificationTokenService from '#modules/auth/services/email_verification_token_service'
import SendVerificationEmailService from '#modules/auth/services/send_verification_email_service'
import type UsersRepository from '#modules/users/repositories/users_repository'

test.group('SendVerificationEmailService', () => {
  test('rethrows unexpected repository failures by identity', async ({ assert }) => {
    const unexpectedFailure = new Error('unexpected user lock failure')
    const usersRepository = {
      findActiveByIdForUpdate: async () => {
        throw unexpectedFailure
      },
    } as unknown as UsersRepository
    const service = new SendVerificationEmailService(
      new EmailVerificationTokenService(),
      usersRepository
    )

    let failure: unknown
    try {
      await service.handle(42)
    } catch (error) {
      failure = error
    }

    assert.strictEqual(failure, unexpectedFailure)
  })
})
