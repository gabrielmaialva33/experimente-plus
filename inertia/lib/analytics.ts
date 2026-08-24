export type AnalyticsEventType =
  | 'catalog_impression'
  | 'establishment_view'
  | 'route_click'
  | 'whatsapp_click'
  | 'phone_click'
  | 'website_click'
  | 'share_click'
  | 'search_without_results'

export type AnalyticsAction = 'route' | 'whatsapp' | 'phone' | 'website'

export interface AnalyticsEventInput {
  event_id: string
  event_type: AnalyticsEventType
  city_slug: string
  establishment_slug?: string
  category_slug?: string
  search_term?: string
}

const MAX_BATCH_SIZE = 20

export function analyticsEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function trackedActionHref(
  citySlug: string,
  establishmentSlug: string,
  action: AnalyticsAction
): string {
  return `/go/${encodeURIComponent(citySlug)}/${encodeURIComponent(establishmentSlug)}/${action}`
}

export async function trackAnalyticsEvents(events: AnalyticsEventInput[]): Promise<void> {
  if (!analyticsAllowed() || events.length === 0) {
    return
  }

  for (let index = 0; index < events.length; index += MAX_BATCH_SIZE) {
    const batch = events.slice(index, index + MAX_BATCH_SIZE)

    try {
      await fetch('/api/v1/analytics/events', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: batch }),
        credentials: 'same-origin',
        keepalive: true,
      })
    } catch {
      // Analytics must never interrupt catalog navigation or conversion actions.
    }
  }
}

function analyticsAllowed(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean }
  const privacyWindow = window as Window & { doNotTrack?: string }
  const doNotTrack = navigator.doNotTrack || privacyWindow.doNotTrack

  return privacyNavigator.globalPrivacyControl !== true && doNotTrack !== '1'
}
