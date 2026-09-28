import { inject } from '@adonisjs/core'
import { type HttpContext } from '@adonisjs/core/http'
import { errors } from '@vinejs/vine'

import AuthEventService from '#modules/auth/services/auth_event_service'
import RequestPasswordResetService from '#modules/auth/services/request_password_reset_service'
import ResetPasswordService from '#modules/auth/services/reset_password_service'
import SignInService from '#modules/auth/services/sign_in_service'
import type { EmailVerificationPageOutcome } from '#modules/auth/interfaces/email_verification_page'
import SendVerificationEmailService from '#modules/auth/services/send_verification_email_service'
import SignUpService from '#modules/auth/services/sign_up_service'
import VerifyEmailService, {
  type EmailVerificationOutcome,
} from '#modules/auth/services/verify_email_service'
import {
  requestPasswordResetValidator,
  resetPasswordValidator,
} from '#modules/auth/validators/session_validator'
import OrganizationInvitationService from '#modules/organizations/services/organization_invitation_service'
import { pendingInvitationToken } from '#modules/organizations/utils/organization_invitation_session'
import IRole from '#modules/roles/interfaces/role_interface'
import {
  publicRegistrationValidator,
  signInValidator,
} from '#modules/users/validators/users_validator'
import ResolveAuthenticatedLandingService from '#modules/web/services/resolve_authenticated_landing_service'
import { preventCredentialResponseCaching } from '#modules/web/utils/credential_response'
import {
  EMAIL_VERIFICATION_PATH,
  ORGANIZATION_INVITATION_ACCEPT_PATH,
  safeReturnPath,
} from '#modules/web/utils/return_path'
import { setPrivateResponseHeaders } from '#shared/utils/private_response_headers'

/** The outcome crosses the redirect that drops the token as a flash message. */
const EMAIL_VERIFICATION_FLASH_KEY = 'email_verification'
const EMAIL_VERIFICATION_OUTCOMES = new Set<string>([
  'confirmed',
  'already_confirmed',
  'expired',
  'invalid',
])

function pageOutcome(outcome: EmailVerificationOutcome): EmailVerificationPageOutcome {
  if (outcome.status === 'verified') return 'confirmed'
  if (outcome.status === 'already_verified') return 'already_confirmed'
  return outcome.status
}

@inject()
export default class InertiaAuthController {
  constructor(
    private requestPasswordResetService: RequestPasswordResetService,
    private resetPasswordService: ResetPasswordService,
    private signInService: SignInService,
    private signUpService: SignUpService,
    private verifyEmailService: VerifyEmailService,
    private sendVerificationEmailService: SendVerificationEmailService,
    private organizationInvitationService: OrganizationInvitationService,
    private landing: ResolveAuthenticatedLandingService
  ) {}

  async showLogin(ctx: HttpContext) {
    preventCredentialResponseCaching(ctx)
    return ctx.inertia.render('auth/login', { next: safeReturnPath(ctx.request.qs().next) })
  }

  async showRegister(ctx: HttpContext) {
    preventCredentialResponseCaching(ctx)
    const next = safeReturnPath(ctx.request.qs().next)

    return ctx.inertia.render('auth/register', {
      next,
      invitation:
        next === ORGANIZATION_INVITATION_ACCEPT_PATH ? await this.pendingInvitation(ctx) : null,
    })
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
    await this.requestPasswordResetService.run(email)

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
      await this.resetPasswordService.run(token, password)

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
      const result = await this.signInService.run({ uid, password, ctx }, { issueApiTokens: false })

      await auth
        .use('jwt')
        .generate(result.user, result.activeTenantId ? { tenantId: result.activeTenantId } : {})

      return response.redirect(
        safeReturnPath(request.body().next) ??
          (await this.landing.run(result.user, result.activeTenantId))
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
      const { user, activeTenantId, emailVerificationSent } = await this.signUpService.run(data, {
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

      return response.redirect(
        safeReturnPath(request.body().next) ?? (await this.landing.run(user, activeTenantId))
      )
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

  /**
   * The link in the confirmation e-mail. It consumes the token with the same
   * service as `GET /api/v1/verify-email`, flashes the outcome and redirects
   * to the bare path, so the token leaves the address bar and history before
   * anything renders. Without a token the page shows where the account stands.
   */
  async showEmailVerification(ctx: HttpContext) {
    const { auth, inertia, request, response, session } = ctx
    setPrivateResponseHeaders(response)

    const token: unknown = request.qs().token
    if (token !== undefined) {
      const outcome =
        typeof token === 'string' && token.length <= 256
          ? pageOutcome(await this.verifyEmailService.verify(token))
          : 'invalid'
      session.flash(EMAIL_VERIFICATION_FLASH_KEY, outcome)
      return response.redirect().toPath(EMAIL_VERIFICATION_PATH)
    }

    const guard = auth.use('jwt')
    const viewer = (await guard.check()) ? (guard.user ?? null) : null
    const flashed: unknown = session.flashMessages.get(EMAIL_VERIFICATION_FLASH_KEY)
    let outcome =
      typeof flashed === 'string' && EMAIL_VERIFICATION_OUTCOMES.has(flashed)
        ? (flashed as EmailVerificationPageOutcome)
        : null
    // A used link no longer matches anything; for its own confirmed owner it
    // is simply "already confirmed".
    if (outcome === 'invalid' && viewer?.email_verified) {
      outcome = 'already_confirmed'
    }

    return inertia.render('auth/verify_email', {
      outcome,
      viewer: viewer
        ? { signed_in: true, email: viewer.email, email_verified: viewer.email_verified }
        : { signed_in: false, email: null, email_verified: null },
    })
  }

  /** "Enviar novo link" on the confirmation page, for the signed-in account. */
  async resendEmailVerification(ctx: HttpContext) {
    const { auth, response, session } = ctx
    const user = auth.getUserOrFail()
    const result = await this.sendVerificationEmailService.handle(user.id)

    if (result === 'already_verified') {
      session.flash('success', 'Seu e-mail já está confirmado. Não é preciso fazer mais nada.')
    } else if (result === 'delivery_failed') {
      session.flash(
        'error',
        'Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos.'
      )
    } else {
      session.flash(
        'success',
        `Enviamos um novo link para ${user.email}. Ele vale por 24 horas e substitui os anteriores.`
      )
    }

    return response.redirect().toPath(EMAIL_VERIFICATION_PATH)
  }

  async logout(ctx: HttpContext) {
    const user = ctx.auth.user ?? null
    ctx.auth.use('jwt').clearCookie()
    AuthEventService.emitLogout(user, ctx)

    // "Entrar com outra conta" on the invitation page signs out and returns
    // to sign-in, which then brings the person back to the invitation.
    const next = safeReturnPath(ctx.request.body().next)
    if (next) {
      return ctx.response.redirect().toPath(`/login?next=${encodeURIComponent(next)}`)
    }

    return ctx.response.redirect('/')
  }

  /**
   * The invitation held in this browser's session, for pre-filling sign-up.
   * The address is shown only to whoever opened the e-mailed link here, and
   * only while the invitation can still be accepted.
   */
  private async pendingInvitation(ctx: HttpContext) {
    const token = pendingInvitationToken(ctx.session)
    if (!token) {
      return null
    }

    return this.organizationInvitationService.signUpContext(token)
  }
}
