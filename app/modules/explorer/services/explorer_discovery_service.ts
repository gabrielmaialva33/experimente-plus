import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import NotFoundException from '#exceptions/not_found_exception'
import IExplorer from '#modules/explorer/interfaces/explorer_interface'
import ExplorerItineraryRepository from '#modules/explorer/repositories/explorer_itinerary_repository'
import ExplorerSuggestionRepository from '#modules/explorer/repositories/explorer_suggestion_repository'
import CityRepository from '#modules/geography/repositories/city_repository'

/**
 * What the Explorer's own layer suggests from the person's choices: places to
 * add to an itinerary.
 *
 * It reads only the caller's itinerary and the public catalogue.
 * Nothing here reads, counts or returns anyone else's preferences.
 */
@inject()
export default class ExplorerDiscoveryService {
  constructor(
    private itineraries: ExplorerItineraryRepository,
    private suggestions: ExplorerSuggestionRepository,
    private cities: CityRepository
  ) {}

  /**
   * "Sugestões para o roteiro": places to add next, owner only.
   *
   * With a located stop, the nearest public places to the stops' centroid.
   * Without one, the most viewed of the itinerary's city — the first stop's,
   * or the city the app is showing while the route is still empty — or of the
   * operation. The city the app sends is checked as the catalogue checks it,
   * so a bad slug is refused rather than silently widened.
   */
  async itinerarySuggestions(
    tenantId: number,
    userId: number,
    itineraryId: number,
    citySlug: string | null
  ): Promise<IExplorer.ItinerarySuggestions> {
    // Another person's itinerary is absent, never forbidden, as on every route of it.
    const itinerary = await this.itineraries.findOwned(tenantId, userId, itineraryId)
    if (!itinerary) throw new NotFoundException('Itinerary not found')
    const hintedCityId = citySlug ? await this.requireCityId(tenantId, citySlug) : null

    const stops = await this.suggestions.locatedStops(tenantId, itineraryId)
    const located = stops.flatMap((stop) =>
      stop.latitude !== null && stop.longitude !== null
        ? [{ latitude: stop.latitude, longitude: stop.longitude }]
        : []
    )
    const centroid =
      located.length > 0
        ? {
            latitude: located.reduce((sum, stop) => sum + stop.latitude, 0) / located.length,
            longitude: located.reduce((sum, stop) => sum + stop.longitude, 0) / located.length,
          }
        : null

    const data = await this.suggestions.suggest({
      tenantId,
      itineraryId,
      centroid,
      cityId: centroid ? null : (stops[0]?.city_id ?? hintedCityId),
      viewsSince: DateTime.utc()
        .minus({ days: IExplorer.SUGGESTIONS_POPULARITY_DAYS })
        .toISODate()!,
      limit: IExplorer.SUGGESTIONS_LIMIT,
    })

    return { basis: centroid ? 'nearby' : 'popular', data }
  }

  private async requireCityId(tenantId: number, citySlug: string): Promise<number> {
    const slug = citySlug.trim().toLowerCase()
    const city = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      ? await this.cities.findBySlugForTenant(tenantId, slug)
      : null
    if (!city || !city.is_active || !city.region?.is_active) {
      throw new NotFoundException('City not found')
    }
    return city.id
  }
}
