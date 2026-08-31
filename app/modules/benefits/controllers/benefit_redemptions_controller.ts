import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'
import {
  benefitPresentationRequestValidator,
  benefitPresentationTokenValidator,
} from '#modules/benefits/validators/benefit_redemption_validator'

@inject()
export default class BenefitRedemptionsController {
  constructor(private redemptionService: BenefitRedemptionService) {}

  async present({ auth, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(benefitPresentationRequestValidator)
    const origin = `${request.protocol()}://${request.host()}`
    const presentation = await this.redemptionService.present(
      tenant!.id,
      payload.access_id,
      payload.offer_id,
      auth.getUserOrFail(),
      origin
    )
    return response.created(presentation)
  }

  async preview({ auth, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(benefitPresentationTokenValidator)
    const preview = await this.redemptionService.preview(
      tenant!.id,
      payload.token,
      auth.getUserOrFail()
    )
    return response.ok(preview)
  }

  async store({ auth, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(benefitPresentationTokenValidator)
    const receipt = await this.redemptionService.redeem(
      tenant!.id,
      payload.token,
      auth.getUserOrFail()
    )
    return response.ok(receipt)
  }

  async myHistory({ auth, response, tenant }: HttpContext) {
    const history = await this.redemptionService.holderHistory(tenant!.id, auth.getUserOrFail())
    return response.ok(history)
  }

  async myReceipt({ auth, params, response, tenant }: HttpContext) {
    const receipt = await this.redemptionService.holderReceipt(
      tenant!.id,
      String(params.receiptCode),
      auth.getUserOrFail()
    )
    return response.ok(receipt)
  }

  async partnerHistory({ auth, response, tenant }: HttpContext) {
    const history = await this.redemptionService.partnerHistory(tenant!.id, auth.getUserOrFail())
    return response.ok(history)
  }
}
