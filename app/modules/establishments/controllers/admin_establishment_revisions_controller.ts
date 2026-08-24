import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import EstablishmentModerationService from '#modules/establishments/services/establishment_moderation_service'
import {
  approveEstablishmentRevisionValidator,
  listEstablishmentReviewQueueValidator,
  rejectEstablishmentRevisionValidator,
  requestEstablishmentRevisionChangesValidator,
} from '#modules/establishments/validators/establishment_review_validator'

@inject()
export default class AdminEstablishmentRevisionsController {
  constructor(private moderationService: EstablishmentModerationService) {}

  async index({ auth, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listEstablishmentReviewQueueValidator)
    const result = await this.moderationService.list(
      tenant!.id,
      {
        organization_id: query.organization_id,
        city_id: query.city_id,
        page: query.page ?? 1,
        per_page: query.per_page ?? 20,
      },
      auth.getUserOrFail()
    )

    return response.ok(result)
  }

  async show({ auth, params, response, tenant }: HttpContext) {
    const result = await this.moderationService.show(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )

    return response.ok(result)
  }

  async approve({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(approveEstablishmentRevisionValidator)
    const result = await this.moderationService.approve(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload.reason
    )

    return result.approved ? response.ok(result) : response.unprocessableEntity(result)
  }

  async requestChanges({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(requestEstablishmentRevisionChangesValidator)
    const result = await this.moderationService.requestChanges(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )

    return response.ok(result)
  }

  async reject({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(rejectEstablishmentRevisionValidator)
    const result = await this.moderationService.reject(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload.reason
    )

    return response.ok(result)
  }
}
