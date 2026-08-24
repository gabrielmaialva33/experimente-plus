import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import MediaModerationService from '#modules/media/services/media_moderation_service'
import {
  approveMediaValidator,
  listMediaModerationValidator,
  rejectMediaValidator,
} from '#modules/media/validators/media_validator'

@inject()
export default class MediaModerationController {
  constructor(private moderationService: MediaModerationService) {}

  async index({ auth, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listMediaModerationValidator)
    const media = await this.moderationService.list(
      {
        status: query.status ?? 'pending',
        tenant_id: tenant!.id,
        page: query.page ?? 1,
        per_page: query.per_page ?? 20,
      },
      auth.getUserOrFail()
    )

    return response.ok(media)
  }

  async approve({ auth, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(approveMediaValidator)
    const media = await this.moderationService.approve(
      Number(params.id),
      auth.getUserOrFail(),
      payload.reason
    )

    return response.ok(media)
  }

  async reject({ auth, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(rejectMediaValidator)
    const media = await this.moderationService.reject(
      Number(params.id),
      auth.getUserOrFail(),
      payload.reason
    )

    return response.ok(media)
  }

  async quarantine({ auth, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(rejectMediaValidator)
    const media = await this.moderationService.quarantine(
      Number(params.id),
      auth.getUserOrFail(),
      payload.reason
    )

    return response.ok(media)
  }
}
