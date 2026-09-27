import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import VerifyEmailService from '#modules/auth/services/verify_email_service'
import SendVerificationEmailService from '#modules/auth/services/send_verification_email_service'
import { verifyEmailValidator } from '#modules/auth/validators/email_verification_validator'
import { EMAIL_VERIFICATION_PATH } from '#modules/web/utils/return_path'

@inject()
export default class EmailVerificationController {
  constructor(
    private verifyEmailService: VerifyEmailService,
    private sendVerificationEmailService: SendVerificationEmailService
  ) {}

  /**
   * Verify email with a token.
   *
   * Links sent before the web page existed point here. A browser, which asks
   * for HTML, is sent to that page with the same query token, where it is
   * consumed and stripped from the address; API clients keep the JSON contract.
   */
  async verify({ request, response }: HttpContext) {
    if (request.accepts(['json', 'html']) === 'html') {
      const token: unknown = request.qs().token
      const query =
        typeof token === 'string' && token.length > 0 && token.length <= 256
          ? `?token=${encodeURIComponent(token)}`
          : ''
      return response.redirect().toPath(`${EMAIL_VERIFICATION_PATH}${query}`)
    }

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
