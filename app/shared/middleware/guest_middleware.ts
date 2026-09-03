import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

import { resolveAuthenticatedLandingPath } from '#modules/web/utils/authenticated_landing'
import { preventCredentialResponseCaching } from '#modules/web/utils/credential_response'

/**
 * Guest middleware is used to deny access to routes that should
 * be accessed by unauthenticated users.
 *
 * For example, the login page should not be accessible if the user
 * is already logged-in
 */
export default class GuestMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { guards?: (keyof Authenticators)[] } = {}
  ) {
    preventCredentialResponseCaching(ctx)

    for (let guard of options.guards || [ctx.auth.defaultGuard]) {
      const activeGuard = ctx.auth.use(guard)
      if (await activeGuard.check()) {
        const user = activeGuard.user
        if (!user) return next()
        const claimedTenantId =
          guard === 'jwt' ? ctx.auth.use('jwt').tokenPayload?.tenantId : undefined
        return ctx.response.redirect(
          await resolveAuthenticatedLandingPath(user, claimedTenantId),
          true
        )
      }
    }

    return next()
  }
}
