import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import type { DateTime } from 'luxon'

import PasswordResetNotification from '#modules/auth/services/password_reset_notification'
import PasswordResetTokenService from '#modules/auth/services/password_reset_token_service'
import type User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

class PasswordResetEmailDeliveryError extends Error {
  constructor(readonly reason: unknown) {
    super('Password reset email delivery failed')
  }
}

@inject()
export default class RequestPasswordResetService {
  constructor(
    private usersRepository: UsersRepository,
    private passwordResetTokenService: PasswordResetTokenService
  ) {}

  async run(email: string): Promise<void> {
    const user = await this.usersRepository.findBy('email', email.trim().toLowerCase())
    if (!user) {
      return
    }

    try {
      await this.issueAndDeliver(user.id)
    } catch (error) {
      if (!(error instanceof PasswordResetEmailDeliveryError)) {
        throw error
      }

      HttpContext.get()?.logger.error(
        { error: error.reason, userId: user.id },
        'Failed to deliver password reset email'
      )
    }
  }

  /**
   * Delivery intentionally runs before commit. An SMTP failure rolls back the
   * new token and restores any previous active link. There is still an
   * unavoidable narrow window where SMTP accepts the email and the subsequent
   * database commit fails; eliminating it requires a durable outbox rather
   * than pretending email and PostgreSQL share an atomic transaction.
   */
  protected async issueAndDeliver(userId: number): Promise<void> {
    await db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveByIdForUpdate(userId, client)
      if (!user) {
        return
      }

      const { token, expiresAt } = await this.passwordResetTokenService.issueForLockedUser(
        user.id,
        client
      )

      try {
        await this.deliver(user, token, expiresAt)
      } catch (error) {
        throw new PasswordResetEmailDeliveryError(error)
      }
    })
  }

  /** Narrow seam for deterministic delivery-failure and concurrency tests. */
  protected async deliver(user: User, token: string, expiresAt: DateTime): Promise<void> {
    await mail.send(new PasswordResetNotification(user, token, expiresAt))
  }
}
