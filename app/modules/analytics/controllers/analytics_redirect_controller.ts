import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import NotFoundException from '#exceptions/not_found_exception'
import { ANALYTICS_EXTERNAL_ACTIONS } from '#modules/analytics/interfaces/analytics_interface'
import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsEventService from '#modules/analytics/services/analytics_event_service'
import AnalyticsRedirectService from '#modules/analytics/services/analytics_redirect_service'
import AnalyticsSessionService from '#modules/analytics/services/analytics_session_service'
import AnalyticsTrackingPreferenceService from '#modules/analytics/services/analytics_tracking_preference_service'

@inject()
export default class AnalyticsRedirectController {
  constructor(
    private eventService: AnalyticsEventService,
    private redirectService: AnalyticsRedirectService,
    private sessionService: AnalyticsSessionService,
    private trackingPreference: AnalyticsTrackingPreferenceService
  ) {}

  async redirect(context: HttpContext) {
    const action = String(context.params.action)
    if (!ANALYTICS_EXTERNAL_ACTIONS.includes(action as IAnalytics.ExternalAction)) {
      throw new NotFoundException('Tracked action not found')
    }

    const hostname = context.request.hostname()
    const tenantId = await this.eventService.resolveTenant(hostname)
    const trackingAllowed = this.trackingPreference.allows(
      context.request.header('dnt'),
      context.request.header('sec-gpc')
    )
    const anonymousSessionHash = trackingAllowed
      ? this.sessionService.resolve(context, tenantId)
      : null
    const destination = await this.redirectService.destination(
      tenantId,
      String(context.params.citySlug),
      String(context.params.establishmentSlug),
      action as IAnalytics.ExternalAction,
      anonymousSessionHash
    )

    return context.response.redirect(destination)
  }
}
