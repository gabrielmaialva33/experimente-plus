import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import OrganizationClaimService from '#modules/organizations/services/organization_claim_service'
import { createOrganizationClaimValidator } from '#modules/organizations/validators/organization_validator'

@inject()
export default class OrganizationClaimsController {
  constructor(private claimService: OrganizationClaimService) {}

  async store({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createOrganizationClaimValidator)
    const claim = await this.claimService.create(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )
    return response.created(claim)
  }
}
