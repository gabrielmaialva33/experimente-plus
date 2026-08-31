import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BenefitAccessService from '#modules/benefits/services/benefit_access_service'
import {
  grantBenefitAccessValidator,
  revokeBenefitAccessValidator,
} from '#modules/benefits/validators/benefit_access_validator'

@inject()
export default class BenefitAccessesController {
  constructor(private accessService: BenefitAccessService) {}

  async index({ auth, response, tenant }: HttpContext) {
    const accesses = await this.accessService.list(tenant!.id, auth.getUserOrFail())
    return response.ok(accesses)
  }

  async store({ auth, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(grantBenefitAccessValidator)
    const access = await this.accessService.grant(tenant!.id, auth.getUserOrFail(), payload)
    return response.created(access)
  }

  async revoke({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(revokeBenefitAccessValidator)
    const access = await this.accessService.revoke(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )
    return response.ok(access)
  }
}
