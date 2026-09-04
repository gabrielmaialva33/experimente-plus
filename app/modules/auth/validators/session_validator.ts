import vine from '@vinejs/vine'

import {
  PASSWORD_RESET_TOKEN_LENGTH,
  PASSWORD_RESET_TOKEN_PATTERN,
} from '#modules/auth/utils/password_reset_token'
import { refreshTokenField } from '#modules/auth/validators/refresh_token_field'

export const refreshSessionValidator = vine.compile(
  vine.object({
    refresh_token: refreshTokenField(),
  })
)

export const requestPasswordResetValidator = vine.compile(
  vine.object({
    email: vine.string().trim().toLowerCase().maxLength(254).email(),
  })
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine
      .string()
      .fixedLength(PASSWORD_RESET_TOKEN_LENGTH)
      .regex(PASSWORD_RESET_TOKEN_PATTERN),
    password: vine.string().minLength(8).confirmed({ confirmationField: 'password_confirmation' }),
  })
)
