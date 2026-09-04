import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import {
  apiThrottle,
  passwordResetRequestThrottle,
  passwordResetThrottle,
  signInThrottle,
  signUpThrottle,
} from '#start/limiter'
import { privateResponseHeadersMiddleware } from '#shared/utils/private_response_headers'

const SessionsController = () => import('#modules/auth/controllers/sessions_controller')
const PasswordResetController = () => import('#modules/auth/controllers/password_reset_controller')
const EmailVerificationController = () =>
  import('#modules/auth/controllers/email_verification_controller')
const MeController = () => import('#modules/auth/controllers/me_controller')

/**
 * Sessions (sign in / sign up)
 */
router
  .group(() => {
    router
      .post('/sign-in', [SessionsController, 'signIn'])
      .as('session.signIn')
      .use([privateResponseHeadersMiddleware, signInThrottle])
    router
      .post('/sign-up', [SessionsController, 'signUp'])
      .as('session.signUp')
      .use([privateResponseHeadersMiddleware, signUpThrottle])
    router
      .post('/forgot-password', [PasswordResetController, 'forgot'])
      .as('session.forgotPassword')
      .use([privateResponseHeadersMiddleware, passwordResetRequestThrottle])
    router
      .post('/reset-password', [PasswordResetController, 'reset'])
      .as('session.resetPassword')
      .use([privateResponseHeadersMiddleware, passwordResetThrottle])
    router
      .post('/refresh', [SessionsController, 'refresh'])
      .as('session.refresh')
      .use([privateResponseHeadersMiddleware, apiThrottle])
    router
      .post('/logout', [SessionsController, 'logout'])
      .as('session.logout')
      .use([privateResponseHeadersMiddleware, apiThrottle])
  })
  .prefix('/api/v1/sessions')

/**
 * Email verification
 */
router
  .group(() => {
    router.get('/verify-email', [EmailVerificationController, 'verify'])
    router
      .post('/resend-verification-email', [EmailVerificationController, 'resend'])
      .use(middleware.auth({ guards: ['jwt'] }))
  })
  .prefix('/api/v1')

/**
 * Current authenticated user (me)
 */
router
  .group(() => {
    router.get('/', [MeController, 'profile']).as('me.profile')
    router.patch('/', [MeController, 'update']).as('me.update')
    router
      .get('/context', [MeController, 'context'])
      .as('me.context')
      .use(middleware.tenant({ required: true }))
    router.get('/permissions', [MeController, 'permissions']).as('me.permissions')
    router.get('/roles', [MeController, 'roles']).as('me.roles')
    router.delete('/', [MeController, 'delete']).as('me.delete')
  })
  .prefix('/api/v1/me')
  .use([middleware.auth(), privateResponseHeadersMiddleware, apiThrottle])
  .as('me')
