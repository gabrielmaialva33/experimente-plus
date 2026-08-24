import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import EstablishmentMediaService from '#modules/media/services/establishment_media_service'
import {
  createEstablishmentMediaValidator,
  reorderEstablishmentMediaValidator,
  updateEstablishmentMediaValidator,
} from '#modules/media/validators/media_validator'

@inject()
export default class EstablishmentMediaController {
  constructor(private mediaService: EstablishmentMediaService) {}

  async index({ auth, params, response, tenant }: HttpContext) {
    const media = await this.mediaService.list(tenant!.id, Number(params.id), auth.getUserOrFail())

    return response.ok(media)
  }

  async store({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createEstablishmentMediaValidator)
    const file = request.file('file', {
      size: '10mb',
      extnames: ['jpeg', 'jpg', 'png', 'webp'],
    })

    if (!file) {
      return response.unprocessableEntity({
        errors: [
          {
            field: 'file',
            rule: 'required',
            message: 'The file field is required',
          },
        ],
      })
    }

    if (!file.isValid) {
      return response.unprocessableEntity({
        errors: file.errors.map((error) => ({
          field: 'file',
          rule: error.type === 'size' ? 'file_size' : 'file_extname',
          message:
            error.type === 'size'
              ? `File size should be less than ${file.sizeLimit}`
              : 'Invalid image extension. Allowed: jpeg, jpg, png, webp',
        })),
      })
    }

    const media = await this.mediaService.upload(
      {
        tenantId: tenant!.id,
        establishmentId: Number(params.id),
        actor: auth.getUserOrFail(),
      },
      file,
      payload
    )

    return response.created(media)
  }

  async update({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateEstablishmentMediaValidator)
    const media = await this.mediaService.update(
      {
        tenantId: tenant!.id,
        establishmentId: Number(params.id),
        actor: auth.getUserOrFail(),
      },
      Number(params.mediaId),
      payload
    )

    return response.ok(media)
  }

  async cover({ auth, params, response, tenant }: HttpContext) {
    const media = await this.mediaService.setCover(
      {
        tenantId: tenant!.id,
        establishmentId: Number(params.id),
        actor: auth.getUserOrFail(),
      },
      Number(params.mediaId)
    )

    return response.ok(media)
  }

  async reorder({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(reorderEstablishmentMediaValidator)
    const media = await this.mediaService.reorder(
      {
        tenantId: tenant!.id,
        establishmentId: Number(params.id),
        actor: auth.getUserOrFail(),
      },
      payload.media
    )

    return response.ok(media)
  }

  async destroy({ auth, params, response, tenant }: HttpContext) {
    await this.mediaService.remove(
      {
        tenantId: tenant!.id,
        establishmentId: Number(params.id),
        actor: auth.getUserOrFail(),
      },
      Number(params.mediaId)
    )

    return response.noContent()
  }
}
