import { type HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { errors } from '@vinejs/vine'

import AuthEventService from '#modules/auth/services/auth_event_service'
import RequestPasswordResetService from '#modules/auth/services/request_password_reset_service'
import ResetPasswordService from '#modules/auth/services/reset_password_service'
import SignInService from '#modules/auth/services/sign_in_service'
import SignUpService from '#modules/auth/services/sign_up_service'
import {
  requestPasswordResetValidator,
  resetPasswordValidator,
} from '#modules/auth/validators/session_validator'
import IRole from '#modules/roles/interfaces/role_interface'
import {
  publicRegistrationValidator,
  signInValidator,
} from '#modules/users/validators/users_validator'
import { resolveAuthenticatedLandingPath } from '#modules/web/utils/authenticated_landing'
import { preventCredentialResponseCaching } from '#modules/web/utils/credential_response'

export default class InertiaAuthController {
  async showLogin(ctx: HttpContext) {
    preventCredentialResponseCaching(ctx)
    return ctx.inertia.render('auth/login', {})
  }

  async showRegister(ctx: HttpContext) {
    preventCredentialResponseCaching(ctx)
    return ctx.inertia.render('auth/register', {})
  }

  async showForgotPassword(ctx: HttpContext) {
    preventCredentialResponseCaching(ctx)
    return ctx.inertia.render('auth/forgot_password', {})
  }

  async forgotPassword(ctx: HttpContext) {
    preventCredentialResponseCaching(ctx)
    const { request, response, session } = ctx
    const { email } = await request.validateUsing(requestPasswordResetValidator, {
      data: request.body(),
    })
    const service = await app.container.make(RequestPasswordResetService)
    await service.run(email)

    session.flash(
      'success',
      'Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.'
    )
    return response.redirect().back()
  }

  async showResetPassword(ctx: HttpContext) {
    preventCredentialResponseCaching(ctx)
    return ctx.inertia.render('auth/reset_password', {
      token: String(ctx.request.input('token', '')),
    })
  }

  async resetPassword(ctx: HttpContext) {
    preventCredentialResponseCaching(ctx)
    const { request, response, session } = ctx
    try {
      const { token, password } = await request.validateUsing(resetPasswordValidator, {
        data: request.body(),
      })
      const service = await app.container.make(ResetPasswordService)
      await service.run(token, password)

      session.flash('success', 'Senha redefinida com sucesso. Você já pode entrar.')
      return response.redirect().toPath('/login')
    } catch {
      session.flash('errors', {
        general: 'Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.',
      })
      // Never reflect a credential-bearing Referer after rejecting the body.
      // The user must return through a freshly issued reset link.
      return response.redirect().toPath('/reset-password')
    }
  }

  async login(ctx: HttpContext) {
    preventCredentialResponseCaching(ctx)
    const { request, response, session, auth } = ctx
    const { uid, password } = await request.validateUsing(signInValidator, {
      data: request.body(),
    })

    try {
      const signInService = await app.container.make(SignInService)
      const result = await signInService.run({ uid, password, ctx }, { issueApiTokens: false })

      await auth
        .use('jwt')
        .generate(result.user, result.activeTenantId ? { tenantId: result.activeTenantId } : {})

      return response.redirect(
        await resolveAuthenticatedLandingPath(result.user, result.activeTenantId)
      )
    } catch {
      session.flash('errors', {
        general: 'Não foi possível entrar. Verifique suas credenciais e tente novamente.',
      })
      return response.redirect().back()
    }
  }

  async register(ctx: HttpContext) {
    preventCredentialResponseCaching(ctx)
    const { request, response, session, auth } = ctx

    try {
      const registration = await request.validateUsing(publicRegistrationValidator, {
        data: request.body(),
      })
      const data = {
        full_name: registration.full_name,
        email: registration.email,
        username: registration.username,
        password: registration.password,
      }
      const signUpService = await app.container.make(SignUpService)
      const { user, activeTenantId, emailVerificationSent } = await signUpService.run(data, {
        issueApiTokens: false,
      })

      await auth.use('jwt').generate(user, activeTenantId ? { tenantId: activeTenantId } : {})
      if (!emailVerificationSent) {
        session.flash(
          'error',
          'Sua conta foi criada, mas o e-mail de verificação não pôde ser enviado. Tente reenviá-lo mais tarde.'
        )
      }

      const isAdmin = user.roles.some((role) =>
        [IRole.Slugs.ADMIN, IRole.Slugs.ROOT].includes(role.slug)
      )
      AuthEventService.emitLoginSucceeded(user, 'password', isAdmin, ctx)

      return response.redirect(await resolveAuthenticatedLandingPath(user, activeTenantId))
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        throw error
      }

      session.flash('errors', {
        general: 'Não foi possível concluir o cadastro. Tente novamente em instantes.',
      })
      return response.redirect().back()
    }
  }

  async logout(ctx: HttpContext) {
    const user = ctx.auth.user ?? null
    ctx.auth.use('jwt').clearCookie()
    AuthEventService.emitLogout(user, ctx)

    return ctx.response.redirect('/')
  }
}
