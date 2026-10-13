import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BenefitAccessService from '#modules/benefits/services/benefit_access_service'
import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'
import BenefitSavingsService from '#modules/benefits/services/benefit_savings_service'
import { setPrivateResponseHeaders } from '#shared/utils/private_response_headers'

@inject()
export default class BenefitWalletController {
  constructor(
    private accessService: BenefitAccessService,
    private redemptionService: BenefitRedemptionService,
    private savingsService: BenefitSavingsService
  ) {}

  async show({ auth, response, tenant }: HttpContext) {
    const actor = auth.getUserOrFail()
    const baseWallet = await this.accessService.wallet(tenant!.id, actor)
    const wallet = await this.redemptionService.decorateWallet(tenant!.id, actor.id, baseWallet)
    return response.ok(wallet)
  }

  async savings({ auth, response, tenant }: HttpContext) {
    const actor = auth.getUserOrFail()
    return response.ok(await this.savingsService.forHolder(tenant!.id, actor.id))
  }

  async page({ auth, inertia, response, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)
    const actor = auth.getUserOrFail()
    const baseWallet = await this.accessService.wallet(tenant!.id, actor)
    const wallet = await this.redemptionService.decorateWallet(tenant!.id, actor.id, baseWallet)
    const savings = await this.savingsService.forHolder(tenant!.id, actor.id)
    return inertia.render('wallet/index', { wallet, savings })
  }
}
