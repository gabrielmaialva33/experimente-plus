import { useEffect, useRef } from 'react'

import { analyticsEventId, trackAnalyticsEvents, type AnalyticsEventInput } from '~/lib/analytics'
import type { CatalogDetail, CatalogSearchResult } from '~/lib/catalog'

function useAnalyticsBatch(signature: string, events: AnalyticsEventInput[]) {
  const sentSignature = useRef<string | null>(null)

  useEffect(() => {
    if (!signature || sentSignature.current === signature || events.length === 0) return
    sentSignature.current = signature
    void trackAnalyticsEvents(events)
  }, [events, signature])
}

export function useCatalogSearchAnalytics(citySlug: string, result: CatalogSearchResult) {
  const items = [...result.sponsored, ...result.organic]
  const signature = [
    citySlug,
    result.query.q,
    result.query.category,
    result.query.openNow,
    result.query.sort,
    result.meta.page,
    items.map((item) => item.slug).join(','),
  ].join('|')

  const events: AnalyticsEventInput[] = items.map((item) => ({
    event_id: analyticsEventId(),
    event_type: 'catalog_impression',
    city_slug: citySlug,
    establishment_slug: item.slug,
    category_slug: item.primaryCategory?.slug ?? result.query.category ?? undefined,
    search_term: result.query.q || undefined,
  }))

  if (result.query.q && result.meta.total === 0) {
    events.push({
      event_id: analyticsEventId(),
      event_type: 'search_without_results',
      city_slug: citySlug,
      category_slug: result.query.category ?? undefined,
      search_term: result.query.q,
    })
  }

  useAnalyticsBatch(signature, events)
}

export function useEstablishmentViewAnalytics(detail: CatalogDetail) {
  const signature = `${detail.city.slug}|${detail.slug}|view`
  useAnalyticsBatch(signature, [
    {
      event_id: analyticsEventId(),
      event_type: 'establishment_view',
      city_slug: detail.city.slug,
      establishment_slug: detail.slug,
      category_slug: detail.categories.find((category) => category.isPrimary)?.slug,
    },
  ])
}
