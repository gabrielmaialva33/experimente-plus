import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

import { resolveAuthenticatedLandingPath } from '#modules/web/utils/authenticated_landing'

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
    for (let guard of options.guards || [ctx.auth.defaultGuard]) {
      const activeGuard = ctx.auth.use(guard)
      if (await activeGuard.check()) {
        const user = activeGuard.user
        if (!user) return next()
        return ctx.response.redirect(await resolveAuthenticatedLandingPath(user), true)
      }
    }

    return next()
  }
}
