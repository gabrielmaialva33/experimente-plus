import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import PartnerContentMediaService from '#modules/partner_content/services/partner_content_media_service'
import {
  approvePartnerContentMediaValidator,
  contentIdParamsValidator,
  contentMediaParamsValidator,
  createPartnerContentMediaValidator,
  rejectPartnerContentMediaValidator,
  updatePartnerContentMediaValidator,
} from '#modules/partner_content/validators/partner_content_validator'

@inject()
export default class PartnerContentMediaController {
  constructor(private mediaService: PartnerContentMediaService) {}

  async index({ auth, params, tenant }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    return this.mediaService.listForPartner({
      kind: IPartnerContent.kindOfPath(path),
      tenantId: tenant!.id,
      contentId: id,
      actor: auth.getUserOrFail(),
    })
  }

  async store({ auth, params, request, response, tenant }: HttpContext) {
    const { kind: path, id } = await contentIdParamsValidator.validate(params)
    const payload = await request.validateUsing(createPartnerContentMediaValidator)
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
        kind: IPartnerContent.kindOfPath(path),
        tenantId: tenant!.id,
        contentId: id,
        actor: auth.getUserOrFail(),
      },
      file,
      payload
    )

    return response.created(media)
  }

  async update({ auth, params, request, tenant }: HttpContext) {
    const { kind: path, id, mediaId } = await contentMediaParamsValidator.validate(params)
    const payload = await request.validateUsing(updatePartnerContentMediaValidator)

    return this.mediaService.update(
      {
        kind: IPartnerContent.kindOfPath(path),
        tenantId: tenant!.id,
        contentId: id,
        actor: auth.getUserOrFail(),
      },
      mediaId,
      payload
    )
  }

  async cover({ auth, params, tenant }: HttpContext) {
    const { kind: path, id, mediaId } = await contentMediaParamsValidator.validate(params)
    return this.mediaService.setCover(
      {
        kind: IPartnerContent.kindOfPath(path),
        tenantId: tenant!.id,
        contentId: id,
        actor: auth.getUserOrFail(),
      },
      mediaId
    )
  }

  async destroy({ auth, params, response, tenant }: HttpContext) {
    const { kind: path, id, mediaId } = await contentMediaParamsValidator.validate(params)
    await this.mediaService.remove(
      {
        kind: IPartnerContent.kindOfPath(path),
        tenantId: tenant!.id,
        contentId: id,
        actor: auth.getUserOrFail(),
      },
      mediaId
    )
    return response.noContent()
  }

  async approve({ auth, params, request, tenant }: HttpContext) {
    const { kind: path, id, mediaId } = await contentMediaParamsValidator.validate(params)
    const payload = await request.validateUsing(approvePartnerContentMediaValidator)
    return this.mediaService.approve(
      {
        kind: IPartnerContent.kindOfPath(path),
        tenantId: tenant!.id,
        contentId: id,
        actor: auth.getUserOrFail(),
      },
      mediaId,
      payload.reason
    )
  }

  async reject({ auth, params, request, tenant }: HttpContext) {
    const { kind: path, id, mediaId } = await contentMediaParamsValidator.validate(params)
    const payload = await request.validateUsing(rejectPartnerContentMediaValidator)
    return this.mediaService.reject(
      {
        kind: IPartnerContent.kindOfPath(path),
        tenantId: tenant!.id,
        contentId: id,
        actor: auth.getUserOrFail(),
      },
      mediaId,
      payload.reason
    )
  }

  async quarantine({ auth, params, request, tenant }: HttpContext) {
    const { kind: path, id, mediaId } = await contentMediaParamsValidator.validate(params)
    const payload = await request.validateUsing(rejectPartnerContentMediaValidator)
    return this.mediaService.quarantine(
      {
        kind: IPartnerContent.kindOfPath(path),
        tenantId: tenant!.id,
        contentId: id,
        actor: auth.getUserOrFail(),
      },
      mediaId,
      payload.reason
    )
  }
}
