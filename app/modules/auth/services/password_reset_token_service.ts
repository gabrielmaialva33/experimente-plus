import { createHmac, randomBytes } from 'node:crypto'

import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import PasswordResetTokenRepository from '#modules/auth/repositories/password_reset_token_repository'
import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import {
  isCanonicalPasswordResetToken,
  PASSWORD_RESET_TOKEN_BYTES,
} from '#modules/auth/utils/password_reset_token'
import type User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'
import env from '#start/env'

const INVALID_PASSWORD_RESET_TOKEN_MESSAGE = 'Invalid or expired password reset token'

export type IssuedPasswordResetToken = {
  token: string
  expiresAt: DateTime
}

@inject()
export default class PasswordResetTokenService {
  constructor(
    private passwordResetTokenRepository: PasswordResetTokenRepository,
    private usersRepository: UsersRepository,
    private credentialInvalidationService: CredentialInvalidationService
  ) {}

  async issue(userId: number): Promise<IssuedPasswordResetToken | null> {
    return db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveByIdForUpdate(userId, client)
      if (!user) {
        return null
      }

      return this.issueForLockedUser(user.id, client)
    })
  }

  /**
   * Rotate reset credentials after the caller has locked the user row with
   * `FOR UPDATE` on this same transaction client. Keeping this primitive
   * transaction-aware lets delivery remain inside the lock/rollback boundary.
   */
  async issueForLockedUser(
    userId: number,
    client: TransactionClientContract
  ): Promise<IssuedPasswordResetToken> {
    const now = DateTime.now()
    const expiresAt = now.plus({ minutes: env.get('PASSWORD_RESET_TTL_MINUTES', 60) })
    const token = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('base64url')

    await this.passwordResetTokenRepository.consumeActiveForUser(userId, client, now)
    await this.passwordResetTokenRepository.create(
      {
        user_id: userId,
        token_hash: this.hashToken(token),
        expires_at: expiresAt,
        consumed_at: null,
      },
      { client }
    )

    return { token, expiresAt }
  }

  async consume(token: string, password: string): Promise<User> {
    if (!isCanonicalPasswordResetToken(token)) {
      throw new BadRequestException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE)
    }

    const tokenHash = this.hashToken(token)
    const ownerUserId = await this.passwordResetTokenRepository.findOwnerByHash(tokenHash)

    if (ownerUserId === null) {
      throw new BadRequestException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE)
    }

    return db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveByIdForUpdate(ownerUserId, client)
      if (!user) {
        throw new BadRequestException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE)
      }

      const current = await this.passwordResetTokenRepository.findByHashAndUserForUpdate(
        tokenHash,
        ownerUserId,
        client
      )
      const now = DateTime.now()

      if (!current || current.consumed_at || current.expires_at.toMillis() <= now.toMillis()) {
        throw new BadRequestException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE)
      }

      user.useTransaction(client)
      user.password = password
      await user.save()

      await this.credentialInvalidationService.run(user.id, client, now)

      return user
    })
  }

  private hashToken(token: string): string {
    return createHmac('sha256', env.get('PASSWORD_RESET_SECRET', env.get('APP_KEY')))
      .update(token)
      .digest('hex')
  }
}
