import { type symbols } from '@adonisjs/auth'
import { type GuardConfigProvider } from '@adonisjs/auth/types'
import type { HttpContext } from '@adonisjs/core/http'
import { type Secret } from '@adonisjs/core/helpers'

import { JWT_COOKIE_NAME } from '#shared/jwt/constants'
import { JwtGuard } from '#shared/jwt/jwt'
import type { JwtGuardOptions, JwtGuardUser, JwtUserProviderContract } from '#shared/jwt/types'

export function jwtGuard<UserProvider extends JwtUserProviderContract<unknown>>(config: {
  provider: UserProvider
  secret?: string
  tokenExpiresIn?: JwtGuardOptions['expiresIn']
  issuer?: string
  audience?: string
  useCookies?: boolean
  cookieName?: string
  content: (
    user: JwtGuardUser<UserProvider[typeof symbols.PROVIDER_REAL_USER]>
  ) => Record<string, unknown>
  getCredentialVersion: (
    user: JwtGuardUser<UserProvider[typeof symbols.PROVIDER_REAL_USER]>
  ) => number
}): GuardConfigProvider<(ctx: HttpContext) => JwtGuard<UserProvider>> {
  return {
    async resolver(_, app) {
      const appKey = (app.config.get('app.appKey') as Secret<string>).release()
      const options: JwtGuardOptions = {
        secret: config.secret ?? appKey,
        expiresIn: config.tokenExpiresIn,
        issuer: config.issuer,
        audience: config.audience,
        useCookies: config.useCookies,
        cookieName: config.cookieName ?? JWT_COOKIE_NAME,
        cookieOptions: {
          path: '/',
          httpOnly: true,
          secure: app.inProduction,
          sameSite: 'lax',
        },
        content: config.content,
        getCredentialVersion: config.getCredentialVersion,
      }

      return (ctx) => new JwtGuard(ctx, config.provider, options)
    },
  }
}
