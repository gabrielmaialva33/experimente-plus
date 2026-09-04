import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import InvalidBenefitPresentationException, {
  INVALID_BENEFIT_PRESENTATION_MESSAGE,
} from '#exceptions/invalid_benefit_presentation_exception'
import BenefitPresentationOriginService from '#modules/benefits/services/benefit_presentation_origin_service'
import BenefitRedemptionService from '#modules/benefits/services/benefit_redemption_service'
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

  async validate({ auth, inertia, request, response, session, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)
    const input = request.input('token')
    const actor = auth.getUserOrFail()
    let token = ''
    let preview: Awaited<ReturnType<BenefitRedemptionService['preview']>> | null = null

    try {
      token = normalizeBenefitPresentationTokenQuery(input)
      preview = token ? await this.redemptionService.preview(tenant!.id, token, actor) : null
    } catch (error) {
      if (!(error instanceof InvalidBenefitPresentationException)) {
        throw error
      }

      session.flash('errors', { presentation: INVALID_BENEFIT_PRESENTATION_MESSAGE })
      return response.redirect().toPath('/portal/redemptions/validate')
    }

    const allowedActions = preview
      ? await this.resourceAuthorization.forOrganization(
          tenant!.id,
          preview.benefit.organization_id,
          actor
        )
      : await this.resourceAuthorization.forActor(tenant!.id, actor)

    return inertia.render('portal/redemptions/validate', {
      token,
      preview,
      allowed_actions: allowedActions,
    })
  }

  async redeem({ auth, request, response, session, tenant }: HttpContext) {
    let receipt: Awaited<ReturnType<BenefitRedemptionService['redeem']>>

    try {
      const payload = await validateBenefitPresentationTokenInput(request, ['json', 'urlencoded'])
      receipt = await this.redemptionService.redeem(tenant!.id, payload.token, auth.getUserOrFail())
    } catch (error) {
      if (!(error instanceof InvalidBenefitPresentationException) && !isVineValidationError(error)) {
        throw error
      }

      session.flash('errors', { presentation: INVALID_BENEFIT_PRESENTATION_MESSAGE })
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
}

function isVineValidationError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && error.code === 'E_VALIDATION_ERROR'
  )
}
