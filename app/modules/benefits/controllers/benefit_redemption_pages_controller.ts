import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'
import { benefitPresentationTokenValidator } from '#modules/benefits/validators/benefit_redemption_validator'

@inject()
export default class BenefitRedemptionPagesController {
  constructor(private redemptionService: BenefitRedemptionService) {}

  async present({ auth, inertia, params, request, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const origin = `${request.protocol()}://${request.host()}`
    const presentation = await this.redemptionService.present(
      tenant!.id,
      Number(params.accessId),
      Number(params.offerId),
      auth.getUserOrFail(),
      origin
    )
    return inertia.render('wallet/present', { presentation })
  }

  async walletHistory({ auth, inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const history = await this.redemptionService.holderHistory(tenant!.id, auth.getUserOrFail())
    return inertia.render('wallet/redemptions', { history })
  }

  async walletReceipt({ auth, inertia, params, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const receipt = await this.redemptionService.holderReceipt(
      tenant!.id,
      String(params.receiptCode),
      auth.getUserOrFail()
    )
    return inertia.render('wallet/receipt', { receipt })
  }

  async validate({ auth, inertia, request, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const input = request.input('token')
    const token = typeof input === 'string' ? input.trim() : ''
    const preview = token
      ? await this.redemptionService.preview(tenant!.id, token, auth.getUserOrFail())
      : null

    return inertia.render('portal/redemptions/validate', { token, preview })
  }

  async redeem({ auth, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(benefitPresentationTokenValidator)
    const receipt = await this.redemptionService.redeem(
      tenant!.id,
      payload.token,
      auth.getUserOrFail()
    )
    session.flash('success', 'Benefício validado e comprovante emitido.')
    return response.redirect().toPath(`/portal/redemptions/${receipt.receipt_code}`)
  }

  async partnerHistory({ auth, inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const history = await this.redemptionService.partnerHistory(tenant!.id, auth.getUserOrFail())
    return inertia.render('portal/redemptions/index', { history })
  }

  async partnerReceipt({ auth, inertia, params, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const receipt = await this.redemptionService.partnerReceipt(
      tenant!.id,
      String(params.receiptCode),
      auth.getUserOrFail()
    )
    return inertia.render('portal/redemptions/receipt', { receipt })
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
    response.header('Referrer-Policy', 'no-referrer')
  }
}
