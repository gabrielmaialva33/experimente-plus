import { type HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

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

export default class InertiaAuthController {
  async showLogin({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  async showRegister({ inertia }: HttpContext) {
    return inertia.render('auth/register', {})
  }

  async showForgotPassword({ inertia }: HttpContext) {
    return inertia.render('auth/forgot_password', {})
  }

  async forgotPassword({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(requestPasswordResetValidator)
    const service = await app.container.make(RequestPasswordResetService)
    await service.run(email)

    session.flash(
      'success',
      'Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.'
    )
    return response.redirect().back()
  }

  async showResetPassword({ request, inertia }: HttpContext) {
    return inertia.render('auth/reset_password', {
      token: String(request.input('token', '')),
    })
  }

  async resetPassword({ request, response, session }: HttpContext) {
    try {
      const { token, password } = await request.validateUsing(resetPasswordValidator)
      const service = await app.container.make(ResetPasswordService)
      await service.run(token, password)

      session.flash('success', 'Senha redefinida com sucesso. Você já pode entrar.')
      return response.redirect().toPath('/login')
    } catch {
      session.flash('errors', {
        general: 'Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.',
      })
      return response.redirect().back()
    }
  }

  async login(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const { uid, password } = await request.validateUsing(signInValidator)

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
    const { request, response, session, auth } = ctx

    try {
      const registration = await request.validateUsing(publicRegistrationValidator)
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
      if (error && typeof error === 'object' && 'messages' in error) {
        session.flash('errors', error.messages as Record<string, unknown>)
      } else {
        session.flash('errors', {
          general: 'Não foi possível concluir o cadastro. Tente novamente em instantes.',
        })
      }
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
