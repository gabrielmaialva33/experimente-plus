import db from '@adonisjs/lucid/services/db'

import { discoverableEstablishmentsForTenantSql } from '#modules/catalog/repositories/catalog_discoverability'
import type IExplorer from '#modules/explorer/interfaces/explorer_interface'
import {
  cardOf,
  ESTABLISHMENT_CARD_COLUMNS,
  type CardColumns,
} from '#modules/explorer/repositories/explorer_cards'

/** A stop whose place is still public, with what the suggestions need of it. */
export interface LocatedStop {
  establishment_id: number
  city_id: number
  latitude: number | null
  longitude: number | null
}

export interface SuggestionCriteria {
  tenantId: number
  itineraryId: number
  /** Present when at least one stop has coordinates: rank by distance to it. */
  centroid: { latitude: number; longitude: number } | null
  /** Narrows a `popular` list to one city; never set together with a centroid. */
  cityId: number | null
  /** The first day of the views that count, as `YYYY-MM-DD`. */
  viewsSince: string
  limit: number
}

/**
 * Great-circle distance, in kilometres, between the projection's coordinates
 * and the centroid bound as `?, ?, ?` (latitude, latitude, longitude). `least`
 * keeps rounding from pushing `asin` past its domain for two equal points.
 */
const HAVERSINE_KM = `
  6371 * 2 * asin(least(1, sqrt(
    power(sin(radians(projection.latitude::double precision - ?::double precision) / 2), 2)
    + cos(radians(?::double precision))
      * cos(radians(projection.latitude::double precision))
      * power(sin(radians(projection.longitude::double precision - ?::double precision) / 2), 2)
  )))
`

/**
 * "Sugestões para o roteiro" — places to add next.
 *
 * Read from the discoverable projection, like every Explorer card, so nothing
 * withheld can be suggested. Popularity is the operation's own aggregate of
 * establishment views: it orders the list and is never returned, and nothing
 * here reads who viewed, favourited or followed anything.
 */
export default class ExplorerSuggestionRepository {
  /** The itinerary's stops that point at a public place, in route order. */
  async locatedStops(tenantId: number, itineraryId: number): Promise<LocatedStop[]> {
    const result = await db.rawQuery(
      `
      SELECT
        projection.establishment_id,
        projection.city_id,
        projection.latitude,
        projection.longitude
      FROM explorer_itinerary_items stop
      JOIN (${discoverableEstablishmentsForTenantSql}) projection
        ON projection.establishment_id = stop.establishment_id
       AND projection.tenant_id = stop.tenant_id
      WHERE stop.tenant_id = ? AND stop.itinerary_id = ?
      ORDER BY stop.position ASC, stop.id ASC
      `,
      [tenantId, tenantId, itineraryId]
    )

    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      establishment_id: Number(row.establishment_id),
      city_id: Number(row.city_id),
      latitude: coordinate(row.latitude),
      longitude: coordinate(row.longitude),
    }))
  }

  async suggest(criteria: SuggestionCriteria): Promise<IExplorer.ItinerarySuggestion[]> {
    const { tenantId, itineraryId, centroid, cityId, viewsSince, limit } = criteria

    const distanceSql = centroid
      ? `CASE WHEN projection.latitude IS NULL OR projection.longitude IS NULL THEN NULL
         ELSE ${HAVERSINE_KM} END`
      : 'NULL::double precision'
    const distanceBindings = centroid
      ? [centroid.latitude, centroid.latitude, centroid.longitude]
      : []

    const result = await db.rawQuery(
      `
      WITH popularity AS (
        SELECT metric.establishment_id, SUM(metric.event_count)::bigint AS views
        FROM analytics_daily_metrics metric
        WHERE metric.tenant_id = ?
          AND metric.event_type = 'establishment_view'
          AND metric.metric_date >= ?::date
        GROUP BY metric.establishment_id
      ),
      candidates AS (
        SELECT
          projection.*,
          coalesce(popularity.views, 0) AS views,
          ${distanceSql} AS distance_km
        FROM (${discoverableEstablishmentsForTenantSql}) projection
        LEFT JOIN popularity ON popularity.establishment_id = projection.establishment_id
        WHERE projection.business_status = 'open'
          ${cityId === null ? '' : 'AND projection.city_id = ?'}
          AND NOT EXISTS (
            SELECT 1
            FROM explorer_itinerary_items stop
            WHERE stop.tenant_id = projection.tenant_id
              AND stop.itinerary_id = ?
              AND stop.establishment_id = projection.establishment_id
          )
      )
      SELECT ${ESTABLISHMENT_CARD_COLUMNS}, projection.distance_km
      FROM candidates projection
      ORDER BY
        round(projection.distance_km::numeric, 1) ASC NULLS LAST,
        projection.views DESC,
        projection.public_name ASC,
        projection.establishment_id ASC
      LIMIT ?
      `,
      [
        tenantId,
        viewsSince,
        ...distanceBindings,
        tenantId,
        ...(cityId === null ? [] : [cityId]),
        itineraryId,
        limit,
      ]
    )

    return (result.rows as Array<CardColumns & { distance_km: unknown }>).map((row) => {
      const distance = coordinate(row.distance_km)
      return {
        establishment: cardOf(row),
        distance_km: distance === null ? null : Math.round(distance * 10) / 10,
      }
    })
  }
}

/** `numeric` and `double precision` both arrive as text or number; neither is trusted. */
function coordinate(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
