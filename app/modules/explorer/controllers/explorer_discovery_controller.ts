import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ExplorerDiscoveryService from '#modules/explorer/services/explorer_discovery_service'
import {
  followingUpdatesQueryValidator,
  itineraryParamsValidator,
  suggestionsQueryValidator,
} from '#modules/explorer/validators/explorer_validator'

/**
 * Suggestions drawn from the person's own choices — the itinerary they are
 * building and the places they follow. Private like the rest of `/api/v1/me`:
 * the headers come from the route group.
 */
@inject()
export default class ExplorerDiscoveryController {
  constructor(private discovery: ExplorerDiscoveryService) {}

  async itinerarySuggestions({ auth, params, request, tenant }: HttpContext) {
    const { id } = await itineraryParamsValidator.validate(params)
    const { city } = await request.validateUsing(suggestionsQueryValidator)
    return this.discovery.itinerarySuggestions(
      tenant!.id,
      auth.getUserOrFail().id,
      id,
      city ?? null
    )
  }

  async followingUpdates({ auth, request, tenant }: HttpContext) {
    const query = await request.validateUsing(followingUpdatesQueryValidator)
    return this.discovery.followingUpdates(tenant!.id, auth.getUserOrFail().id, query)
  }
}
