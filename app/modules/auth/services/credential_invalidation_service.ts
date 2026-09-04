import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import PasswordResetTokenRepository from '#modules/auth/repositories/password_reset_token_repository'
import RefreshTokenRepository from '#modules/auth/repositories/refresh_token_repository'

/**
 * Invalidates every server-side credential after the caller has locked the
 * owning user. Keeping password-reset rows before refresh rows establishes one
 * lock order for password changes and account deletion.
 */
@inject()
export default class CredentialInvalidationService {
  constructor(
    private passwordResetTokenRepository: PasswordResetTokenRepository,
    private refreshTokenRepository: RefreshTokenRepository
  ) {}

  async run(
    userId: number,
    client: TransactionClientContract,
    invalidatedAt: DateTime = DateTime.now()
  ): Promise<void> {
    await this.passwordResetTokenRepository.consumeActiveForUser(userId, client, invalidatedAt)
    await this.refreshTokenRepository.revokeAllForUser(userId, client, invalidatedAt)
    await client.from('auth_access_tokens').where('tokenable_id', userId).delete()
  }
}
