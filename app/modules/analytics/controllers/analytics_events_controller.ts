import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import AnalyticsEventService from '#modules/analytics/services/analytics_event_service'
import AnalyticsSessionService from '#modules/analytics/services/analytics_session_service'
import AnalyticsTrackingPreferenceService from '#modules/analytics/services/analytics_tracking_preference_service'
import { ingestAnalyticsEventsValidator } from '#modules/analytics/validators/analytics_validator'

@inject()
export default class AnalyticsEventsController {
  constructor(
    private eventService: AnalyticsEventService,
    private sessionService: AnalyticsSessionService,
    private trackingPreference: AnalyticsTrackingPreferenceService
  ) {}

  async store(context: HttpContext) {
    const payload = await context.request.validateUsing(ingestAnalyticsEventsValidator)

    if (
      !this.trackingPreference.allows(
        context.request.header('dnt'),
        context.request.header('sec-gpc')
      )
    ) {
      return context.response.accepted({
        accepted: payload.events.length,
        recorded: 0,
        deduplicated: 0,
        suppressed: payload.events.length,
      })
    }

    const hostname = this.hostname(context)
    const tenantId = await this.eventService.resolveTenant(hostname)
    const anonymousSessionHash = this.sessionService.resolve(context, tenantId)
    const result = await this.eventService.recordBatchForTenant(
      tenantId,
      payload.events,
      anonymousSessionHash,
      'web'
    )

    return context.response.accepted(result)
  }

  private hostname({ request }: HttpContext): string | null {
    const forwardedHost = request.header('x-forwarded-host')
    const rawHost = request.header('host')
    const value = forwardedHost ?? rawHost ?? request.hostname()
    const normalized = Array.isArray(value) ? value[0] : value

    return normalized?.split(',')[0]?.trim().replace(/:\d+$/, '').toLowerCase() || null
  }
}
