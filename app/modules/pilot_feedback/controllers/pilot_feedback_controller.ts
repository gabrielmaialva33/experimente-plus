import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import PilotFeedbackService from '#modules/pilot_feedback/services/pilot_feedback_service'
import {
  createPilotFeedbackValidator,
  listPilotFeedbackValidator,
  reviewPilotFeedbackValidator,
} from '#modules/pilot_feedback/validators/pilot_feedback_validator'

@inject()
export default class PilotFeedbackController {
  constructor(private feedbackService: PilotFeedbackService) {}

  async store({ auth, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createPilotFeedbackValidator)
    const feedback = await this.feedbackService.create(tenant!.id, auth.getUserOrFail(), payload)
    return response.created(feedback)
  }

  async index({ auth, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listPilotFeedbackValidator)
    const feedback = await this.feedbackService.list(
      tenant!.id,
      {
        status: query.status,
        context: query.context,
        organization_id: query.organization_id,
        establishment_id: query.establishment_id,
        page: query.page ?? 1,
        per_page: query.per_page ?? 20,
      },
      auth.getUserOrFail()
    )
    return response.ok(feedback)
  }

  async update({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(reviewPilotFeedbackValidator)
    const feedback = await this.feedbackService.review(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )
    return response.ok(feedback)
  }
}
