import vine from '@vinejs/vine'

import {
  EMAIL_VERIFICATION_TOKEN_LENGTH,
  EMAIL_VERIFICATION_TOKEN_PATTERN,
} from '#modules/auth/utils/email_verification_token'

export const verifyEmailValidator = vine.compile(
  vine.object({
    token: vine
      .string()
      .fixedLength(EMAIL_VERIFICATION_TOKEN_LENGTH)
      .regex(EMAIL_VERIFICATION_TOKEN_PATTERN),
  })
)
