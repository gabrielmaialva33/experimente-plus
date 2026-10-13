import { describe, expect, it, vi } from 'vitest'

import { pageHref } from '~/lib/catalog'
import {
  fetchNearby,
  NearbyError,
  nearbyFailureMessage,
  nearbySearchUrl,
  requestPosition,
} from '~/lib/catalog_nearby'

function geolocation(
  outcome: { latitude: number; longitude: number } | { code: number }
): Geolocation {
  return {
    getCurrentPosition: vi.fn((success: PositionCallback, failure?: PositionErrorCallback) => {
      if ('code' in outcome) {
        failure?.({ code: outcome.code, message: 'refused' } as GeolocationPositionError)
      } else {
        success({ coords: outcome } as GeolocationPosition)
      }
    }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  } as unknown as Geolocation
}

const searchBody = {
  context: {
    city: { slug: 'londrina', name: 'Londrina', state_code: 'PR', timezone: 'America/Sao_Paulo' },
    category: null,
  },
  sponsored_results: [],
  organic_results: [
    {
      slug: 'perto',
      name: 'Perto',
      city: { slug: 'londrina', name: 'Londrina', state_code: 'PR' },
      business_status: 'open',
      is_open_now: true,
      benefit_today: true,
    },
  ],
  meta: { total: 1, page: 1, per_page: 20, last_page: 1 },
  query: {
    q: null,
    category: null,
    open_now: false,
    benefit_today: true,
    attributes: [],
    sort: 'distance',
  },
}

describe('nearest first on the web', () => {
  it('asks the browser once and rounds the position to about eleven metres', async () => {
    const browser = geolocation({ latitude: -23.310_512_3, longitude: -51.162_849_9 })

    await expect(requestPosition(browser)).resolves.toEqual({
      latitude: -23.3105,
      longitude: -51.1628,
    })
    expect(browser.getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('tells a refusal from a position the device could not find', async () => {
    await expect(requestPosition(geolocation({ code: 1 }))).rejects.toMatchObject({
      reason: 'denied',
    })
    await expect(requestPosition(geolocation({ code: 2 }))).rejects.toMatchObject({
      reason: 'unavailable',
    })
    await expect(requestPosition(geolocation({ code: 3 }))).rejects.toMatchObject({
      reason: 'unavailable',
    })
    await expect(requestPosition(undefined)).rejects.toMatchObject({ reason: 'unsupported' })
  })

  it('puts the position in the API request and keeps the filters', () => {
    const url = nearbySearchUrl(
      'cornélio',
      { q: 'café', category: 'cafes', openNow: true, benefitToday: true },
      { latitude: -23.3105, longitude: -51.1628 },
      2,
      12
    )

    expect(url.startsWith('/api/v1/catalog/cities/corn%C3%A9lio/establishments?')).toBe(true)
    const parameters = new URL(url, 'https://experimente.test').searchParams
    expect(Object.fromEntries(parameters)).toEqual({
      q: 'café',
      category: 'cafes',
      open_now: 'true',
      benefit_today: 'true',
      sort: 'distance',
      lat: '-23.3105',
      lng: '-51.1628',
      per_page: '12',
      page: '2',
    })
  })

  it('never writes nearest first, or a position, into a page URL', () => {
    expect(
      pageHref(
        '/cidades/londrina',
        { q: '', category: null, openNow: false, benefitToday: true, sort: 'distance' },
        2
      )
    ).toBe('/cidades/londrina?benefit_today=true&page=2')
    expect(
      pageHref('/cidades/londrina', { q: '', category: null, openNow: false, sort: 'rating' }, 1)
    ).toBe('/cidades/londrina?sort=rating')
  })

  it('reads the answer as a catalogue search and fails closed otherwise', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(searchBody), { status: 200 }))
    const result = await fetchNearby('/api/v1/catalog/cities/londrina/establishments?x', ok)

    expect(result.query.sort).toBe('distance')
    expect(result.query.benefitToday).toBe(true)
    expect(result.organic[0]).toMatchObject({ name: 'Perto', benefitToday: true })
    expect(ok).toHaveBeenCalledWith(
      '/api/v1/catalog/cities/londrina/establishments?x',
      expect.objectContaining({ cache: 'no-store', referrerPolicy: 'no-referrer' })
    )

    const failing = vi.fn(async () => new Response('{}', { status: 500 }))
    await expect(fetchNearby('/x', failing)).rejects.toBeInstanceOf(NearbyError)
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(fetchNearby('/x', offline)).rejects.toMatchObject({ reason: 'error' })
  })

  it('says why, and that the list falls back to relevance', () => {
    for (const reason of ['denied', 'unavailable', 'unsupported', 'error'] as const) {
      expect(nearbyFailureMessage(reason)).toMatch(/Mostrando por relevância\.$/)
    }
    expect(nearbyFailureMessage('denied')).toContain('Sem permissão')
  })
})
