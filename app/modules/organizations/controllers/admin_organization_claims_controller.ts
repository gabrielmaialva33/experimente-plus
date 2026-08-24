import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import OrganizationClaimService from '#modules/organizations/services/organization_claim_service'
import {
  listOrganizationClaimsValidator,
  reviewDecisionValidator,
} from '#modules/organizations/validators/organization_validator'

@inject()
export default class AdminOrganizationClaimsController {
  constructor(private claimService: OrganizationClaimService) {}

  async index({ auth, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listOrganizationClaimsValidator)
    const claims = await this.claimService.listForReview(
      tenant!.id,
      auth.getUserOrFail(),
      query.status
    )
    return response.ok(claims)
  }

  async approve({ auth, params, request, response, tenant }: HttpContext) {
    const { reason } = await request.validateUsing(reviewDecisionValidator)
    const claim = await this.claimService.approve(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      reason
    )
    return response.ok(claim)
  }

  async reject({ auth, params, request, response, tenant }: HttpContext) {
    const { reason } = await request.validateUsing(reviewDecisionValidator)
    const claim = await this.claimService.reject(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      reason
    )
    return response.ok(claim)
  }
}
