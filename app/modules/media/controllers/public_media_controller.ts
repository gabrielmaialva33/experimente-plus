import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import PublicMediaProjectionService from '#modules/media/services/public_media_projection_service'

@inject()
export default class PublicMediaController {
  constructor(private publicMediaService: PublicMediaProjectionService) {}

  async index({ params, response }: HttpContext) {
    const projection = await this.publicMediaService.forEstablishment(Number(params.id))
    return response.ok(projection)
  }
}
