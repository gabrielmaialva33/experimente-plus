import vine from '@vinejs/vine'

import { refreshTokenField } from '#modules/auth/validators/refresh_token_field'

export const refreshSessionValidator = vine.compile(
  vine.object({
    refresh_token: refreshTokenField(),
  })
)

export const requestPasswordResetValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim(),
  })
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(32),
    password: vine.string().minLength(8).confirmed({ confirmationField: 'password_confirmation' }),
  })
)
