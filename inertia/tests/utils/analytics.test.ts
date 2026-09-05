import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  analyticsEventId,
  trackAnalyticsEvents,
  trackedActionHref,
  type AnalyticsEventInput,
} from '~/lib/analytics'

const originalDoNotTrack = navigator.doNotTrack
const originalGlobalPrivacyControl = (navigator as Navigator & { globalPrivacyControl?: boolean })
  .globalPrivacyControl

function setPrivacySignals(doNotTrack: string | null, globalPrivacyControl: boolean): void {
  Object.defineProperty(navigator, 'doNotTrack', {
    configurable: true,
    value: doNotTrack,
  })
  Object.defineProperty(navigator, 'globalPrivacyControl', {
    configurable: true,
    value: globalPrivacyControl,
  })
}

function events(total: number): AnalyticsEventInput[] {
  return Array.from({ length: total }, (_, index) => ({
    event_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    event_type: 'catalog_impression',
    city_slug: 'cornelio-procopio',
    establishment_slug: `unidade-${index}`,
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setPrivacySignals(originalDoNotTrack, originalGlobalPrivacyControl ?? false)
})

describe('analytics utilities', () => {
  it('builds only the allowlisted tracked action path', () => {
    expect(trackedActionHref('Cornélio Procópio', 'Café & Bar', 'route')).toBe(
      '/go/Corn%C3%A9lio%20Proc%C3%B3pio/Caf%C3%A9%20%26%20Bar/route'
    )
  })

  it('batches public events without blocking catalog navigation', async () => {
    setPrivacySignals(null, false)
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)

    await trackAnalyticsEvents(events(45))

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const batchSizes = fetchMock.mock.calls.map(([, options]) => {
      const payload = JSON.parse(String((options as RequestInit).body)) as {
        events: AnalyticsEventInput[]
      }
      return payload.events.length
    })
    expect(batchSizes).toEqual([20, 20, 5])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/analytics/events',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
      })
    )
  })

  it('transmits search text only for privacy-redacted no-result analytics', async () => {
    setPrivacySignals(null, false)
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)

    await trackAnalyticsEvents([
      {
        event_id: '00000000-0000-4000-8000-000000000001',
        event_type: 'catalog_impression',
        city_slug: 'londrina',
        establishment_slug: 'bar-estacao-43-londrina',
        category_slug: 'bares',
        search_term: 'Estação',
      },
      {
        event_id: '00000000-0000-4000-8000-000000000002',
        event_type: 'search_without_results',
        city_slug: 'londrina',
        category_slug: 'bares',
        search_term: 'Estação',
      },
    ])

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    const payload = JSON.parse(String(request.body)) as { events: AnalyticsEventInput[] }

    expect(payload.events[0]).not.toHaveProperty('search_term')
    expect(payload.events[1]).toHaveProperty('search_term', 'Estação')
  })

  it('respects Global Privacy Control and Do Not Track', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)

    setPrivacySignals(null, true)
    await trackAnalyticsEvents(events(1))

    setPrivacySignals('1', false)
    await trackAnalyticsEvents(events(1))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('creates a client event id suitable for idempotent ingestion', () => {
    expect(analyticsEventId()).toMatch(/^[0-9a-f-]{20,}$/i)
  })
})
