import { randomBytes, randomUUID } from 'node:crypto'

import { inject } from '@adonisjs/core'
import { errors as authErrors } from '@adonisjs/auth'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import ActiveRootGuardService from '#modules/users/services/active_root_guard_service'
import UsersRepository from '#modules/users/repositories/users_repository'

export type DeleteOwnAccountPayload = {
  currentPassword: string
  confirmation: string
}

@inject()
export default class DeleteOwnAccountService {
  constructor(
    private usersRepository: UsersRepository,
    private credentialInvalidationService: CredentialInvalidationService,
    private activeRootGuardService: ActiveRootGuardService,
    private permissionCacheService: PermissionCacheService
  ) {}

  async run(userId: number, payload: DeleteOwnAccountPayload): Promise<void> {
    if (payload.confirmation.trim().toUpperCase() !== 'EXCLUIR MINHA CONTA') {
      throw new BadRequestException('Digite EXCLUIR MINHA CONTA para confirmar a exclusão da conta')
    }

    const account = await this.usersRepository.findBy('id', userId)
    if (!account) {
      throw new BadRequestException('A senha atual está incorreta')
    }

    let expectedPasswordHash: string
    try {
      const verifiedUser = await this.usersRepository.verifyCredentials(
        account.email,
        payload.currentPassword
      )
      if (verifiedUser.id !== userId) {
        throw new BadRequestException('A senha atual está incorreta')
      }
      expectedPasswordHash = verifiedUser.password
    } catch (error) {
      if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
        throw new BadRequestException('A senha atual está incorreta')
      }
      throw error
    }

    await db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveByIdForUpdate(userId, client)
      if (!user || user.password !== expectedPasswordHash) {
        throw new BadRequestException('A senha atual está incorreta')
      }

      await this.activeRootGuardService.assertCanRemove(userId, client)

      const now = DateTime.now()
      const tombstone = `${user.id}-${randomUUID()}`

      user.useTransaction(client)
      user.full_name = 'Deleted User'
      user.email = `deleted+${tombstone}@example.invalid`
      user.username = `deleted_${tombstone.replaceAll('-', '_')}`
      user.password = randomBytes(48).toString('base64url')
      user.metadata = {
        email_verified: false,
        email_verification_token_hash: null,
        email_verification_sent_at: null,
        email_verified_at: null,
      }
      user.is_deleted = true
      await user.save()

      await this.credentialInvalidationService.run(userId, client, now)
      await client.from('user_roles').where('user_id', userId).delete()
      await client.from('user_permissions').where('user_id', userId).delete()
    })

    await this.permissionCacheService.bumpEpochAfterCommittedMutation()
  }
}
