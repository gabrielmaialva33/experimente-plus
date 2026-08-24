import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import OrganizationMembershipService from '#modules/organizations/services/organization_membership_service'
import { updateOrganizationMemberValidator } from '#modules/organizations/validators/organization_validator'

@inject()
export default class OrganizationMembersController {
  constructor(private membershipService: OrganizationMembershipService) {}

  async index({ auth, params, response, tenant }: HttpContext) {
    const members = await this.membershipService.list(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(members)
  }

  async update({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateOrganizationMemberValidator)
    const member = await this.membershipService.update(
      tenant!.id,
      Number(params.id),
      Number(params.memberId),
      auth.getUserOrFail(),
      payload
    )
    return response.ok(member)
  }

  async destroy({ auth, params, response, tenant }: HttpContext) {
    await this.membershipService.remove(
      tenant!.id,
      Number(params.id),
      Number(params.memberId),
      auth.getUserOrFail()
    )
    return response.noContent()
  }
}
