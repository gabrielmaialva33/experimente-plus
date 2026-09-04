import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import VerifyEmailService from '#modules/auth/services/verify_email_service'
import SendVerificationEmailService from '#modules/auth/services/send_verification_email_service'
import { verifyEmailValidator } from '#modules/auth/validators/email_verification_validator'

@inject()
export default class EmailVerificationController {
  constructor(
    private verifyEmailService: VerifyEmailService,
    private sendVerificationEmailService: SendVerificationEmailService
  ) {}

  /**
   * Verify email with a token
   */
  async verify({ request, response }: HttpContext) {
    const { token } = await request.validateUsing(verifyEmailValidator, {
      data: request.qs(),
    })

    const user = await this.verifyEmailService.handle(token)

    return response.ok({
      message: 'Email verified successfully',
      email_verified: user.metadata.email_verified,
      email_verified_at: user.metadata.email_verified_at,
    })
  }

  /**
   * Resend verification email
   */
  async resend({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const result = await this.sendVerificationEmailService.handle(user.id)

    if (result === 'already_verified') {
      return response.badRequest({
        message: 'Email already verified',
      })
    }

    if (result === 'delivery_failed') {
      return response.serviceUnavailable({
        message: 'Verification email could not be delivered. Please try again later.',
      })
    }

    return response.ok({
      message: 'Verification email sent successfully',
    })
  }
}
