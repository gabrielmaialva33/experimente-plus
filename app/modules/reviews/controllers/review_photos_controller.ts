import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ReviewPhotoService from '#modules/reviews/services/review_photo_service'
import {
  reviewIdValidator,
  reviewPhotoParamsValidator,
  reviewPhotoValidator,
} from '#modules/reviews/validators/review_validator'

/** Photos on the caller's own reviews — ADR-0027, Anexo I item 8. */
@inject()
export default class ReviewPhotosController {
  constructor(private photos: ReviewPhotoService) {}

  async store({ auth, params, request, response, tenant }: HttpContext) {
    const { id } = await reviewIdValidator.validate(params)
    const payload = await request.validateUsing(reviewPhotoValidator)
    // The same formats and size as every other image (ADR-0014). HEIC stays
    // out: the pipeline has no decoder for it, and storing what cannot be
    // probed would publish an image nobody verified.
    const file = request.file('photo', { size: '10mb', extnames: ['jpeg', 'jpg', 'png', 'webp'] })

    if (!file) {
      return response.unprocessableEntity({
        errors: [{ field: 'photo', rule: 'required', message: 'The photo field is required' }],
      })
    }
    if (!file.isValid) {
      return response.unprocessableEntity({
        errors: file.errors.map((error) => ({
          field: 'photo',
          rule: error.type === 'size' ? 'file_size' : 'file_extname',
          message:
            error.type === 'size'
              ? `File size should be less than ${file.sizeLimit}`
              : 'Invalid image extension. Allowed: jpeg, jpg, png, webp',
        })),
      })
    }

    const photo = await this.photos.upload(tenant!.id, id, auth.getUserOrFail(), file, payload)
    return response.created(photo)
  }

  async destroy({ auth, params, response, tenant }: HttpContext) {
    const { id, photoId } = await reviewPhotoParamsValidator.validate(params)
    await this.photos.remove(tenant!.id, id, photoId, auth.getUserOrFail())
    return response.noContent()
  }
}
