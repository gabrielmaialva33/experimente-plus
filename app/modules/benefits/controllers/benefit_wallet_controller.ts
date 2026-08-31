import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BenefitAccessService from '#modules/benefits/services/benefit_access_service'
import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'

@inject()
export default class BenefitWalletController {
  constructor(
    private accessService: BenefitAccessService,
    private redemptionService: BenefitRedemptionService
  ) {}

  async show({ auth, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const actor = auth.getUserOrFail()
    const baseWallet = await this.accessService.wallet(tenant!.id, actor)
    const wallet = await this.redemptionService.decorateWallet(tenant!.id, actor.id, baseWallet)
    return response.ok(wallet)
  }

  async page({ auth, inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const actor = auth.getUserOrFail()
    const baseWallet = await this.accessService.wallet(tenant!.id, actor)
    const wallet = await this.redemptionService.decorateWallet(tenant!.id, actor.id, baseWallet)
    return inertia.render('wallet/index', { wallet })
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
