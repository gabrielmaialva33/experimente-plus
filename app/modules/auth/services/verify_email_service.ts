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

@inject()
export default class VerifyEmailService {
  constructor(
    private usersRepository: UsersRepository,
    private tokenService: EmailVerificationTokenService
  ) {}

  async handle(token: string): Promise<User> {
    const { i18n } = HttpContext.getOrFail()

    if (!isCanonicalEmailVerificationToken(token)) {
      throw new NotFoundException(i18n.t('errors.invalid_verification_token'))
    }

    const tokenHash = this.tokenService.hash(token)
    const ownerUserId = await this.usersRepository.findOwnerByEmailVerificationTokenHash(tokenHash)

    if (ownerUserId === null) {
      throw new NotFoundException(i18n.t('errors.invalid_verification_token'))
    }

    return db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveByIdForUpdate(ownerUserId, client)

      if (!user || user.metadata?.email_verification_token_hash !== tokenHash) {
        throw new NotFoundException(i18n.t('errors.invalid_verification_token'))
      }

      if (user.metadata.email_verified) {
        throw new BadRequestException(i18n.t('errors.email_already_verified'))
      }

      const sentAtValue = user.metadata.email_verification_sent_at
      if (!sentAtValue) {
        throw new NotFoundException(i18n.t('errors.invalid_verification_token'))
      }

      const sentAt = DateTime.fromISO(sentAtValue)
      const expirationTime = sentAt.plus({ hours: 24 })
      if (!sentAt.isValid || DateTime.now().toMillis() >= expirationTime.toMillis()) {
        throw new BadRequestException(i18n.t('errors.verification_token_expired'))
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

      return user
    })
  }
}
