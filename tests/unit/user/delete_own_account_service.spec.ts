import { test } from '@japa/runner'

import type CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import type PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import type UsersRepository from '#modules/users/repositories/users_repository'
import type ActiveRootGuardService from '#modules/users/services/active_root_guard_service'
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
    const activeRootGuardService = {} as ActiveRootGuardService
    let cacheBumps = 0
    const permissionCacheService = {
      async bumpEpochAfterCommittedMutation() {
        cacheBumps++
      },
    } as PermissionCacheService
    const service = new DeleteOwnAccountService(
      usersRepository,
      credentialInvalidationService,
      activeRootGuardService,
      permissionCacheService
    )

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
    assert.equal(cacheBumps, 0)
  })
})
