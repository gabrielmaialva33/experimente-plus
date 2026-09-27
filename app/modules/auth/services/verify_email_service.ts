import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import EmailVerificationTokenService from '#modules/auth/services/email_verification_token_service'
import { isCanonicalEmailVerificationToken } from '#modules/auth/utils/email_verification_token'
import type User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

/**
 * What consuming a verification token did. The API turns each failure into
 * its documented error; the web page renders a state for each one.
 */
export type EmailVerificationOutcome =
  | { status: 'verified'; user: User }
  | { status: 'already_verified' }
  | { status: 'expired' }
  | { status: 'invalid' }

@inject()
export default class VerifyEmailService {
  constructor(
    private usersRepository: UsersRepository,
    private tokenService: EmailVerificationTokenService
  ) {}

  async handle(token: string): Promise<User> {
    const { i18n } = HttpContext.getOrFail()
    const outcome = await this.verify(token)

    switch (outcome.status) {
      case 'verified':
        return outcome.user
      case 'already_verified':
        throw new BadRequestException(i18n.t('errors.email_already_verified'))
      case 'expired':
        throw new BadRequestException(i18n.t('errors.verification_token_expired'))
      default:
        throw new NotFoundException(i18n.t('errors.invalid_verification_token'))
    }
  }

  /**
   * Atomically consumes the exact canonical token. A token is single-use:
   * once consumed, the stored hash is cleared and the same link is `invalid`.
   */
  async verify(token: string): Promise<EmailVerificationOutcome> {
    if (!isCanonicalEmailVerificationToken(token)) {
      return { status: 'invalid' }
    }

    const tokenHash = this.tokenService.hash(token)
    const ownerUserId = await this.usersRepository.findOwnerByEmailVerificationTokenHash(tokenHash)

    if (ownerUserId === null) {
      return { status: 'invalid' }
    }

    return db.transaction(async (client): Promise<EmailVerificationOutcome> => {
      const user = await this.usersRepository.findActiveByIdForUpdate(ownerUserId, client)

      if (!user || user.metadata?.email_verification_token_hash !== tokenHash) {
        return { status: 'invalid' }
      }

      if (user.metadata.email_verified) {
        return { status: 'already_verified' }
      }

      const sentAtValue = user.metadata.email_verification_sent_at
      if (!sentAtValue) {
        return { status: 'invalid' }
      }

      const sentAt = DateTime.fromISO(sentAtValue)
      const expirationTime = sentAt.plus({ hours: 24 })
      if (!sentAt.isValid || DateTime.now().toMillis() >= expirationTime.toMillis()) {
        return { status: 'expired' }
      }

      user.useTransaction(client)
      user.metadata = {
        ...user.metadata,
        email_verified: true,
        email_verified_at: DateTime.now().toISO(),
        email_verification_token_hash: null,
        email_verification_sent_at: null,
      }
      await user.save()

      return { status: 'verified', user }
    })
  }
}
