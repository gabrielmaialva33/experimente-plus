import { createHmac, randomBytes } from 'node:crypto'

import { EMAIL_VERIFICATION_TOKEN_BYTES } from '#modules/auth/utils/email_verification_token'
import env from '#start/env'

export default class EmailVerificationTokenService {
  generate(): { token: string; tokenHash: string } {
    const token = randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString('base64url')
    return { token, tokenHash: this.hash(token) }
  }

  hash(token: string): string {
    return createHmac('sha256', env.get('EMAIL_VERIFICATION_SECRET', env.get('APP_KEY')))
      .update(token)
      .digest('hex')
  }
}
