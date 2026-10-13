import { catalogSearch, type CatalogSearchQuery, type CatalogSearchResult } from '~/lib/catalog'

/**
 * "Mais perto" on the web.
 *
 * A page URL is shared, bookmarked and kept in history, so the visitor's
 * position never enters one. The page asks the browser for it only when the
 * person picks this order, sends it to the public search API in that request
 * alone, and keeps it in memory just long enough to turn the pages of the same
 * search. Nothing here writes it to storage, the URL or analytics.
 */

export interface Position {
  latitude: number
  longitude: number
}

/** Why the nearest-first order could not run; each has its own message. */
export type NearbyFailure = 'denied' | 'unavailable' | 'unsupported' | 'error'

export class NearbyError extends Error {
  constructor(readonly reason: NearbyFailure) {
    super(`Nearby search failed: ${reason}`)
    this.name = 'NearbyError'
  }
}

const GEOLOCATION_PERMISSION_DENIED = 1

/**
 * Four decimal places is about eleven metres: closer than any order between
 * two places needs, and less than the device knows.
 */
const roundCoordinate = (value: number) => Math.round(value * 10_000) / 10_000

/** The browser's position, asked once, for one search. */
export function requestPosition(
  geolocation: Geolocation | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.geolocation
): Promise<Position> {
  if (!geolocation) return Promise.reject(new NearbyError('unsupported'))

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: roundCoordinate(coords.latitude),
          longitude: roundCoordinate(coords.longitude),
        }),
      (error) =>
        reject(
          new NearbyError(error.code === GEOLOCATION_PERMISSION_DENIED ? 'denied' : 'unavailable')
        ),
      // A position from the last few minutes is as good as a new one for an order.
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 15_000 }
    )
  })
}

/** The public API search, nearest first, with the position in this URL only. */
export function nearbySearchUrl(
  citySlug: string,
  query: Pick<CatalogSearchQuery, 'q' | 'category' | 'openNow' | 'benefitToday'>,
  position: Position,
  page: number,
  perPage: number
): string {
  const parameters = new URLSearchParams()
  if (query.q) parameters.set('q', query.q)
  if (query.category) parameters.set('category', query.category)
  if (query.openNow) parameters.set('open_now', 'true')
  if (query.benefitToday) parameters.set('benefit_today', 'true')
  parameters.set('sort', 'distance')
  parameters.set('lat', String(position.latitude))
  parameters.set('lng', String(position.longitude))
  parameters.set('per_page', String(perPage))
  if (page > 1) parameters.set('page', String(page))

  return `/api/v1/catalog/cities/${encodeURIComponent(citySlug)}/establishments?${parameters}`
}

export async function fetchNearby(
  url: string,
  fetcher: typeof fetch = fetch
): Promise<CatalogSearchResult> {
  let response: Response
  try {
    response = await fetcher(url, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    })
  } catch {
    throw new NearbyError('error')
  }
  if (!response.ok) throw new NearbyError('error')

  try {
    return catalogSearch(await response.json())
  } catch {
    throw new NearbyError('error')
  }
}

/** What the page says when nearest first cannot run; it then shows relevance. */
export function nearbyFailureMessage(reason: NearbyFailure): string {
  switch (reason) {
    case 'denied':
      return 'Sem permissão para usar sua localização. Mostrando por relevância.'
    case 'unavailable':
      return 'Não foi possível descobrir onde você está agora. Mostrando por relevância.'
    case 'unsupported':
      return 'Este navegador não informa a localização. Mostrando por relevância.'
    case 'error':
      return 'Não foi possível ordenar por distância agora. Mostrando por relevância.'
  }
}
