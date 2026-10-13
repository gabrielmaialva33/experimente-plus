import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { CatalogSearchQuery, CatalogSearchResult } from '~/lib/catalog'
import {
  fetchNearby,
  NearbyError,
  nearbySearchUrl,
  requestPosition,
  type NearbyFailure,
  type Position,
} from '~/lib/catalog_nearby'

export type NearbyStatus = 'idle' | 'locating' | 'located' | 'loading' | 'ready' | 'failed'

type NearbyFilters = Pick<CatalogSearchQuery, 'q' | 'category' | 'openNow' | 'benefitToday'>

export interface NearbyCatalog {
  status: NearbyStatus
  /** The nearest-first results, while they are the ones on screen. */
  result: CatalogSearchResult | null
  failure: NearbyFailure | null
  /** Asks the browser for the position; false when it cannot be had. */
  locate: () => Promise<boolean>
  /** Runs the search nearest first with these filters; false when it fell through. */
  search: (filters: NearbyFilters, perPage: number) => Promise<boolean>
  goToPage: (page: number) => Promise<void>
  /** Forgets the position and the results: another order took over. */
  reset: () => void
}

const reasonOf = (error: unknown): NearbyFailure =>
  error instanceof NearbyError ? error.reason : 'error'

/**
 * The state of "Mais perto" for one catalogue page.
 *
 * The position lives in a ref of this hook and nowhere else: from the moment
 * the person picks the order to the last page of that search. Another order,
 * clearing the filters or leaving the page drops it.
 */
export function useNearbyCatalog(citySlug: string): NearbyCatalog {
  const [status, setStatus] = useState<NearbyStatus>('idle')
  const [result, setResult] = useState<CatalogSearchResult | null>(null)
  const [failure, setFailure] = useState<NearbyFailure | null>(null)
  const position = useRef<Position | null>(null)
  const pending = useRef<Promise<boolean> | null>(null)
  const lastSearch = useRef<{ filters: NearbyFilters; perPage: number } | null>(null)
  // Each step checks it is still the latest, so a late answer never wins over a newer choice.
  const generation = useRef(0)

  useEffect(
    () => () => {
      generation.current += 1
      position.current = null
    },
    []
  )

  const fail = useCallback((reason: NearbyFailure) => {
    position.current = null
    lastSearch.current = null
    setResult(null)
    setFailure(reason)
    setStatus('failed')
  }, [])

  const locate = useCallback(() => {
    if (position.current) return Promise.resolve(true)
    if (pending.current) return pending.current

    const current = generation.current
    setStatus('locating')
    setFailure(null)
    const attempt = requestPosition()
      .then((found) => {
        if (current !== generation.current) return false
        position.current = found
        setStatus('located')
        return true
      })
      .catch((error: unknown) => {
        if (current === generation.current) fail(reasonOf(error))
        return false
      })
      .finally(() => {
        if (pending.current === attempt) pending.current = null
      })
    pending.current = attempt
    return attempt
  }, [fail])

  const load = useCallback(
    async (filters: NearbyFilters, perPage: number, page: number) => {
      const origin = position.current
      if (!origin) return false

      const current = generation.current
      setStatus('loading')
      try {
        const found = await fetchNearby(nearbySearchUrl(citySlug, filters, origin, page, perPage))
        if (current !== generation.current) return false
        lastSearch.current = { filters, perPage }
        setResult(found)
        setStatus('ready')
        return true
      } catch (error) {
        if (current === generation.current) fail(reasonOf(error))
        return false
      }
    },
    [citySlug, fail]
  )

  const search = useCallback(
    async (filters: NearbyFilters, perPage: number) => {
      if (!(await locate())) return false
      return load(filters, perPage, 1)
    },
    [load, locate]
  )

  const goToPage = useCallback(
    async (page: number) => {
      const previous = lastSearch.current
      if (previous) await load(previous.filters, previous.perPage, page)
    },
    [load]
  )

  const reset = useCallback(() => {
    generation.current += 1
    position.current = null
    pending.current = null
    lastSearch.current = null
    setResult(null)
    setFailure(null)
    setStatus('idle')
  }, [])

  return useMemo(
    () => ({ status, result, failure, locate, search, goToPage, reset }),
    [status, result, failure, locate, search, goToPage, reset]
  )
}
