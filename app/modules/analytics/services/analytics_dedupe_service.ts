import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsPrivacyService from '#modules/analytics/services/analytics_privacy_service'

const FIVE_MINUTES_MS = 5 * 60 * 1000
const THIRTY_SECONDS_MS = 30 * 1000

@inject()
export default class AnalyticsDedupeService {
  constructor(private privacyService: AnalyticsPrivacyService) {}

  key(
    tenantId: number,
    sessionHash: string,
    event: IAnalytics.ResolvedEvent,
    occurredAt: DateTime
  ): string {
    const bucketSize = this.bucketSize(event.event_type)
    const bucket = Math.floor(occurredAt.toMillis() / bucketSize)
    const target =
      'establishment_id' in event.target
        ? `establishment:${event.target.establishment_id}`
        : `search:${event.target.city_id}:${event.search_term_hash}:${event.category_slug ?? ''}`

    return this.privacyService.hash(
      'analytics-dedupe',
      [tenantId, sessionHash, event.event_type, event.source, target, bucket].join(':')
    )
  }

  private bucketSize(eventType: IAnalytics.EventType): number {
    switch (eventType) {
      case 'route_click':
      case 'whatsapp_click':
      case 'phone_click':
      case 'website_click':
      case 'share_click':
        return THIRTY_SECONDS_MS
      default:
        return FIVE_MINUTES_MS
    }
  }
}
