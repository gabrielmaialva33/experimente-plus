import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import AccessTokenRepository from '#modules/auth/repositories/access_token_repository'
import PasswordResetTokenRepository from '#modules/auth/repositories/password_reset_token_repository'
import RefreshTokenRepository from '#modules/auth/repositories/refresh_token_repository'
import UsersRepository from '#modules/users/repositories/users_repository'
import { MAX_CREDENTIAL_VERSION } from '#shared/jwt/credential_version'

export class CredentialVersionExhaustedError extends Error {
  readonly code = 'E_CREDENTIAL_VERSION_EXHAUSTED'

  constructor() {
    super('The credential generation cannot be advanced safely')
    this.name = 'CredentialVersionExhaustedError'
  }
}

/**
 * Invalidates every credential after the caller has locked the owning user.
 * Keeping password-reset rows before refresh rows establishes one lock order
 * for password changes and account deletion. The single generation increment
 * also revokes every already-issued access JWT when this transaction commits.
 */
@inject()
export default class CredentialInvalidationService {
  constructor(
    private passwordResetTokenRepository: PasswordResetTokenRepository,
    private refreshTokenRepository: RefreshTokenRepository,
    private usersRepository: UsersRepository,
    private accessTokenRepository: AccessTokenRepository
  ) {}

  async run(
    userId: number,
    client: TransactionClientContract,
    invalidatedAt: DateTime = DateTime.now()
  ): Promise<void> {
    // Never wrap the generation back to 1: doing so could make an old signed
    // JWT valid again. The caller owns the transaction, so a terminal version
    // also rolls back its password/account mutation and every token change.
    const advanced = await this.usersRepository.advanceCredentialVersion(
      userId,
      MAX_CREDENTIAL_VERSION,
      client
    )
    if (!advanced) {
      throw new CredentialVersionExhaustedError()
    }

    await this.passwordResetTokenRepository.consumeActiveForUser(userId, client, invalidatedAt)
    await this.refreshTokenRepository.revokeAllForUser(userId, client, invalidatedAt)
    await this.accessTokenRepository.deleteAllForUser(userId, client)
  }
}
