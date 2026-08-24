import { randomUUID } from 'node:crypto'

import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

import { ANALYTICS_SESSION_COOKIE } from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsPrivacyService from '#modules/analytics/services/analytics_privacy_service'
import env from '#start/env'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

@inject()
export default class AnalyticsSessionService {
  constructor(private privacyService: AnalyticsPrivacyService) {}

  resolve(context: HttpContext, tenantId: number): string {
    const cookieValue = context.request.encryptedCookie(ANALYTICS_SESSION_COOKIE)
    const sessionId =
      typeof cookieValue === 'string' && UUID_PATTERN.test(cookieValue) ? cookieValue : randomUUID()

    if (sessionId !== cookieValue) {
      const days = env.get('ANALYTICS_SESSION_COOKIE_DAYS') ?? 30
      context.response.encryptedCookie(ANALYTICS_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: app.inProduction,
        path: '/',
        maxAge: `${days}d`,
      })
    }

    return this.privacyService.hash(`analytics-session:${tenantId}`, sessionId)
  }
}
