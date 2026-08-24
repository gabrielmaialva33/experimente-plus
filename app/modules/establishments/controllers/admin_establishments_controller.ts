import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import EstablishmentLifecycleModerationService from '#modules/establishments/services/establishment_lifecycle_moderation_service'
import {
  restoreEstablishmentValidator,
  suspendEstablishmentValidator,
} from '#modules/establishments/validators/establishment_review_validator'

@inject()
export default class AdminEstablishmentsController {
  constructor(private lifecycleService: EstablishmentLifecycleModerationService) {}

  async suspend({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(suspendEstablishmentValidator)
    const result = await this.lifecycleService.suspend(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload.reason
    )

    return response.ok(result)
  }

  async restore({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(restoreEstablishmentValidator)
    const result = await this.lifecycleService.restore(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload.reason
    )

    return response.ok(result)
  }
}
