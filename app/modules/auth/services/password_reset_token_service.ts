import { createHmac, randomBytes } from 'node:crypto'

import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import PasswordResetTokenRepository from '#modules/auth/repositories/password_reset_token_repository'
import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import type User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'
import env from '#start/env'

const PASSWORD_RESET_TOKEN_BYTES = 48

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
    })
  }

  async consume(token: string, password: string): Promise<User> {
    const tokenHash = this.hashToken(token)
    const ownerUserId = await this.passwordResetTokenRepository.findOwnerByHash(tokenHash)

    if (ownerUserId === null) {
      throw new BadRequestException('Invalid or expired password reset token')
    }

    return db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveByIdForUpdate(ownerUserId, client)
      if (!user) {
        throw new BadRequestException('Invalid or expired password reset token')
      }

      const current = await this.passwordResetTokenRepository.findByHashAndUserForUpdate(
        tokenHash,
        ownerUserId,
        client
      )
      const now = DateTime.now()

      if (!current || current.consumed_at || current.expires_at.toMillis() <= now.toMillis()) {
        throw new BadRequestException('Invalid or expired password reset token')
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
