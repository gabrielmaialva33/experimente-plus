import { errors as authErrors } from '@adonisjs/auth'
import { inject } from '@adonisjs/core'
import { type HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import JwtAuthTokensService from '#modules/auth/services/jwt_auth_tokens_service'
import SignInService from '#modules/auth/services/sign_in_service'
import SignUpService from '#modules/auth/services/sign_up_service'
import { refreshTokenFromRawBody } from '#modules/auth/utils/refresh_token_input'
import { refreshSessionValidator } from '#modules/auth/validators/session_validator'
import {
  publicRegistrationValidator,
  signInValidator,
} from '#modules/users/validators/users_validator'

@inject()
export default class SessionsController {
  constructor(private signInService: SignInService) {}

  async signIn(ctx: HttpContext) {
    const { request, response } = ctx
    const { uid, password } = await request.validateUsing(signInValidator, {
      data: request.body(),
    })

    try {
      const { user, auth } = await this.signInService.run({ uid, password, ctx })

      if (!auth) {
        throw new Error('Authentication tokens were not issued')
      }

      return response.json({ ...user.toJSON(), auth })
    } catch (error) {
      if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
        return response.badRequest({
          errors: [{ message: 'Invalid user credentials' }],
        })
      }

      throw error
    }
  }

  async signUp({ request, response }: HttpContext) {
    const registration = await request.validateUsing(publicRegistrationValidator, {
      data: request.body(),
    })
    const payload = {
      full_name: registration.full_name,
      email: registration.email,
      username: registration.username,
      password: registration.password,
    }
    const service = await app.container.make(SignUpService)
    const { user, auth, emailVerificationSent } = await service.run(payload)

    if (!auth) {
      throw new Error('Authentication tokens were not issued')
    }

    return response.created({
      ...user.toJSON(),
      auth,
      email_verification_sent: emailVerificationSent,
    })
  }

  async refresh({ request, response }: HttpContext) {
    const { refresh_token: refreshToken } = await request.validateUsing(refreshSessionValidator, {
      data: { refresh_token: refreshTokenFromRawBody(request) },
    })
    const service = await app.container.make(JwtAuthTokensService)
    const auth = await service.refresh(refreshToken)

    return response.ok({ auth })
  }

  async logout({ request, response }: HttpContext) {
    const { refresh_token: refreshToken } = await request.validateUsing(refreshSessionValidator, {
      data: { refresh_token: refreshTokenFromRawBody(request) },
    })
    const service = await app.container.make(JwtAuthTokensService)
    await service.revoke(refreshToken)

    return response.noContent()
  }
}
