import { test } from '@japa/runner'

import type CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import type UsersRepository from '#modules/users/repositories/users_repository'
import DeleteOwnAccountService from '#modules/users/services/delete_own_account_service'

test.group('DeleteOwnAccountService', () => {
  test('rethrows unexpected credential lookup failures by identity', async ({ assert }) => {
    const unexpectedFailure = new Error('unexpected credential dependency failure')
    const usersRepository = {
      findBy: async () => ({ email: 'account-owner@example.com' }),
      verifyCredentials: async () => {
        throw unexpectedFailure
      },
    } as unknown as UsersRepository
    const credentialInvalidationService = {} as CredentialInvalidationService
    const service = new DeleteOwnAccountService(usersRepository, credentialInvalidationService)

    let failure: unknown
    try {
      await service.run(42, {
        currentPassword: 'password123',
        confirmation: 'EXCLUIR MINHA CONTA',
      })
    } catch (error) {
      failure = error
    }

    assert.strictEqual(failure, unexpectedFailure)
  })
})
