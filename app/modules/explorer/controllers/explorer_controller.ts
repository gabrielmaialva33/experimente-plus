import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ExplorerService from '#modules/explorer/services/explorer_service'
import type { SavedKind } from '#modules/explorer/repositories/explorer_saved_repository'
import {
  establishmentParamsValidator,
  interestsPayloadValidator,
  itineraryParamsValidator,
  itineraryPayloadValidator,
  itineraryStopParamsValidator,
  reorderPayloadValidator,
  stopPayloadValidator,
} from '#modules/explorer/validators/explorer_validator'

/**
 * The Explorer's own layer — ADR-0030, Anexo I item 10.
 *
 * Every response is one person's data. The private headers come from the route
 * group's middleware, as they do for the rest of `/api/v1/me`, so a route added
 * here later cannot forget them.
 */
@inject()
export default class ExplorerController {
  constructor(private explorer: ExplorerService) {}

  async listFavorites(ctx: HttpContext) {
    return this.list('favorite', ctx)
  }

  async listFollows(ctx: HttpContext) {
    return this.list('follow', ctx)
  }

  async favorite(ctx: HttpContext) {
    return this.write('favorite', 'save', ctx)
  }

  async unfavorite(ctx: HttpContext) {
    return this.write('favorite', 'unsave', ctx)
  }

  async follow(ctx: HttpContext) {
    return this.write('follow', 'save', ctx)
  }

  async unfollow(ctx: HttpContext) {
    return this.write('follow', 'unsave', ctx)
  }

  /** What an establishment page needs to draw its own two buttons. */
  async savedStatus({ auth, params, tenant }: HttpContext) {
    const { establishmentId } = await establishmentParamsValidator.validate(params)
    return this.explorer.savedStatus(tenant!.id, auth.getUserOrFail().id, establishmentId)
  }

  async listInterests({ auth, tenant }: HttpContext) {
    return { data: await this.explorer.listInterests(tenant!.id, auth.getUserOrFail().id) }
  }

  async replaceInterests({ auth, request, tenant }: HttpContext) {
    const payload = await request.validateUsing(interestsPayloadValidator)
    return {
      data: await this.explorer.replaceInterests(
        tenant!.id,
        auth.getUserOrFail().id,
        payload.category_slugs
      ),
    }
  }

  async listItineraries({ auth, tenant }: HttpContext) {
    return { data: await this.explorer.listItineraries(tenant!.id, auth.getUserOrFail().id) }
  }

  async showItinerary({ auth, params, tenant }: HttpContext) {
    const { id } = await itineraryParamsValidator.validate(params)
    return this.explorer.showItinerary(tenant!.id, auth.getUserOrFail().id, id)
  }

  async createItinerary({ auth, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(itineraryPayloadValidator)
    const itinerary = await this.explorer.createItinerary(
      tenant!.id,
      auth.getUserOrFail().id,
      payload
    )
    return response.created(itinerary)
  }

  async updateItinerary({ auth, params, request, tenant }: HttpContext) {
    const { id } = await itineraryParamsValidator.validate(params)
    const payload = await request.validateUsing(itineraryPayloadValidator)
    return this.explorer.updateItinerary(tenant!.id, auth.getUserOrFail().id, id, payload)
  }

  async destroyItinerary({ auth, params, response, tenant }: HttpContext) {
    const { id } = await itineraryParamsValidator.validate(params)
    await this.explorer.deleteItinerary(tenant!.id, auth.getUserOrFail().id, id)
    return response.noContent()
  }

  async addStop({ auth, params, request, tenant }: HttpContext) {
    const { id } = await itineraryParamsValidator.validate(params)
    const payload = await request.validateUsing(stopPayloadValidator)
    return this.explorer.addStop(tenant!.id, auth.getUserOrFail().id, id, payload)
  }

  async removeStop({ auth, params, tenant }: HttpContext) {
    const { id, stopId } = await itineraryStopParamsValidator.validate(params)
    return this.explorer.removeStop(tenant!.id, auth.getUserOrFail().id, id, stopId)
  }

  async reorderStops({ auth, params, request, tenant }: HttpContext) {
    const { id } = await itineraryParamsValidator.validate(params)
    const payload = await request.validateUsing(reorderPayloadValidator)
    return this.explorer.reorderStops(tenant!.id, auth.getUserOrFail().id, id, payload)
  }

  private async list(kind: SavedKind, { auth, tenant }: HttpContext) {
    return this.explorer.listSaved(kind, tenant!.id, auth.getUserOrFail().id)
  }

  private async write(
    kind: SavedKind,
    action: 'save' | 'unsave',
    { auth, params, tenant }: HttpContext
  ) {
    const { establishmentId } = await establishmentParamsValidator.validate(params)
    const userId = auth.getUserOrFail().id

    if (action === 'save') {
      await this.explorer.save(kind, tenant!.id, userId, establishmentId)
    } else {
      await this.explorer.unsave(kind, tenant!.id, userId, establishmentId)
    }

    return this.explorer.savedStatus(tenant!.id, userId, establishmentId)
  }
}
