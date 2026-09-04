import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'

import NotFoundException from '#exceptions/not_found_exception'
import EmailVerificationTokenService from '#modules/auth/services/email_verification_token_service'
import VerifyEmailNotification from '#modules/auth/services/verify_email_notification'
import type User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

class VerificationEmailDeliveryError extends Error {
  constructor(readonly reason: unknown) {
    super('Verification email delivery failed')
  }
}

export type VerificationEmailDeliveryResult = 'sent' | 'already_verified' | 'delivery_failed'

@inject()
export default class SendVerificationEmailService {
  constructor(
    private tokenService: EmailVerificationTokenService,
    private usersRepository: UsersRepository
  ) {}

  async handle(userId: number): Promise<VerificationEmailDeliveryResult> {
    try {
      return await db.transaction(async (client) => {
        const user = await this.usersRepository.findActiveByIdForUpdate(userId, client)
        if (!user) {
          throw new NotFoundException('User not found')
        }

        if (user.metadata?.email_verified) {
          return 'already_verified'
        }

        const { token, tokenHash } = this.tokenService.generate()

        user.useTransaction(client)
        user.metadata = {
          ...user.metadata,
          email_verified: false,
          email_verified_at: user.metadata?.email_verified_at ?? null,
          email_verification_token_hash: tokenHash,
          email_verification_sent_at: DateTime.now().toISO(),
        }
        await user.save()

        try {
          await this.deliver(user, token)
        } catch (error) {
          throw new VerificationEmailDeliveryError(error)
        }

        return 'sent'
      })
    } catch (error) {
      if (!(error instanceof VerificationEmailDeliveryError)) {
        throw error
      }

      HttpContext.get()?.logger.error(
        { error: error.reason, userId },
        'Failed to deliver email verification message'
      )
      return 'delivery_failed'
    }
  }

  /**
   * Kept as a narrow seam so delivery failure behavior can be exercised without
   * replacing the process-wide mail manager in concurrent tests.
   */
  protected async deliver(user: User, token: string): Promise<void> {
    await mail.send(new VerifyEmailNotification(user, token))
  }
}
