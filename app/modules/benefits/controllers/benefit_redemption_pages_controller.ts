import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import type IBenefitRedemption from '#modules/benefits/interfaces/benefit_redemption_interface'
import BenefitPresentationOriginService from '#modules/benefits/services/benefit_presentation_origin_service'
import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'
import {
  classifyBenefitRedemptionFailure,
  type BenefitRedemptionRefusal,
} from '#modules/benefits/utils/benefit_redemption_refusal'
import {
  normalizeBenefitPresentationTokenQuery,
  validateBenefitPresentationTokenInput,
} from '#modules/benefits/utils/benefit_presentation_token_input'
import OrganizationResourceAuthorizationService from '#modules/organizations/services/organization_resource_authorization_service'
import { setPrivateResponseHeaders } from '#shared/utils/private_response_headers'

@inject()
export default class BenefitRedemptionPagesController {
  constructor(
    private redemptionService: BenefitRedemptionService,
    private resourceAuthorization: OrganizationResourceAuthorizationService,
    private presentationOrigin: BenefitPresentationOriginService
  ) {}

  async present({ auth, inertia, params, request, response, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)
    const origin = this.presentationOrigin.resolve(request)
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
    setPrivateResponseHeaders(response)
    const history = await this.redemptionService.holderHistory(tenant!.id, auth.getUserOrFail())
    return inertia.render('wallet/redemptions', { history })
  }

  async walletReceipt({ auth, inertia, params, response, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)
    const receipt = await this.redemptionService.holderReceipt(
      tenant!.id,
      String(params.receiptCode),
      auth.getUserOrFail()
    )
    return inertia.render('wallet/receipt', { receipt })
  }

  /**
   * The page, opened directly or by the link a phone camera reads from the QR.
   * A link that carries a token answers with its preview, its original receipt
   * when it was already confirmed, or the refusal in Portuguese; the page then
   * keeps the token in memory and takes it out of the address bar.
   */
  async validate({ auth, inertia, request, response, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)
    const actor = auth.getUserOrFail()
    let token = ''
    let inspection: IBenefitRedemption.InspectionProjection | null = null
    let refusal: BenefitRedemptionRefusal | null = null

    try {
      token = normalizeBenefitPresentationTokenQuery(request.input('token'))
      inspection = token ? await this.redemptionService.inspect(tenant!.id, token, actor) : null
    } catch (error) {
      const failure = classifyBenefitRedemptionFailure(error)
      if (!failure) {
        throw error
      }
      refusal = failure.refusal
    }

    const preview = inspection?.status === 'valid' ? inspection.preview : null
    const allowedActions = preview
      ? await this.resourceAuthorization.forOrganization(
          tenant!.id,
          preview.benefit.organization_id,
          actor
        )
      : await this.resourceAuthorization.forActor(tenant!.id, actor)

    return inertia.render('portal/redemptions/validate', {
      token: preview ? token : '',
      preview,
      receipt: inspection?.status === 'redeemed' ? inspection.receipt : null,
      refusal,
      allowed_actions: allowedActions,
    })
  }

  /**
   * The in-page reader's preview. The token travels in the JSON body, never in
   * the address, and the answer does not echo it back.
   */
  async inspect({ auth, request, response, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)

    try {
      const payload = await validateBenefitPresentationTokenInput(request, ['json'])
      const inspection = await this.redemptionService.inspect(
        tenant!.id,
        payload.token,
        auth.getUserOrFail()
      )
      if (inspection.status === 'redeemed') {
        return response.ok({ outcome: 'redeemed', receipt: inspection.receipt })
      }

      const { expires_at: expiresAt, holder, benefit } = inspection.preview
      return response.ok({
        outcome: 'preview',
        preview: { expires_at: expiresAt, holder, benefit },
      })
    } catch (error) {
      return this.refuse(error, response)
    }
  }

  /**
   * The in-page confirmation. Repeating it with the same token returns the
   * original receipt, so a retry after a lost answer is safe.
   */
  async confirm({ auth, request, response, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)

    try {
      const payload = await validateBenefitPresentationTokenInput(request, ['json'])
      const receipt = await this.redemptionService.redeem(
        tenant!.id,
        payload.token,
        auth.getUserOrFail()
      )
      return response.ok({ outcome: 'confirmed', receipt })
    } catch (error) {
      return this.refuse(error, response)
    }
  }

  async redeem({ auth, request, response, session, tenant }: HttpContext) {
    let receipt: Awaited<ReturnType<BenefitRedemptionService['redeem']>>

    try {
      const payload = await validateBenefitPresentationTokenInput(request, ['json', 'urlencoded'])
      receipt = await this.redemptionService.redeem(tenant!.id, payload.token, auth.getUserOrFail())
    } catch (error) {
      const failure = classifyBenefitRedemptionFailure(error)
      if (!failure) {
        throw error
      }

      session.flash('errors', { presentation: failure.refusal.message })
      return response.redirect().toPath('/portal/redemptions/validate')
    }

    session.flash('success', 'Benefício validado e comprovante emitido.')
    return response.redirect().toPath(`/portal/redemptions/${receipt.receipt_code}`)
  }

  async partnerHistory({ auth, inertia, response, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)
    const actor = auth.getUserOrFail()
    const authorization = await this.resourceAuthorization.forActorContext(tenant!.id, actor)
    const history = await this.redemptionService.partnerHistory(tenant!.id, actor, authorization)
    return inertia.render('portal/redemptions/index', {
      history,
      allowed_actions: authorization.allowed_actions,
    })
  }

  async partnerReceipt({ auth, inertia, params, response, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)
    const receipt = await this.redemptionService.partnerReceipt(
      tenant!.id,
      String(params.receiptCode),
      auth.getUserOrFail()
    )
    return inertia.render('portal/redemptions/receipt', { receipt })
  }

  private refuse(error: unknown, response: HttpContext['response']) {
    const failure = classifyBenefitRedemptionFailure(error)
    if (!failure) {
      throw error
    }

    return response.status(failure.status).json({ outcome: 'refused', refusal: failure.refusal })
  }
}
