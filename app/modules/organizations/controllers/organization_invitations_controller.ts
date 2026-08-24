import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import OrganizationInvitationService from '#modules/organizations/services/organization_invitation_service'
import {
  acceptOrganizationInvitationValidator,
  createOrganizationInvitationValidator,
} from '#modules/organizations/validators/organization_validator'

@inject()
export default class OrganizationInvitationsController {
  constructor(private invitationService: OrganizationInvitationService) {}

  async index({ auth, params, response, tenant }: HttpContext) {
    const invitations = await this.invitationService.list(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(invitations)
  }

  async store({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createOrganizationInvitationValidator)
    const result = await this.invitationService.create(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )
    return response.created(result)
  }

  async resend({ auth, params, response, tenant }: HttpContext) {
    const result = await this.invitationService.resend(
      tenant!.id,
      Number(params.id),
      Number(params.invitationId),
      auth.getUserOrFail()
    )
    return response.ok(result)
  }

  async destroy({ auth, params, response, tenant }: HttpContext) {
    await this.invitationService.revoke(
      tenant!.id,
      Number(params.id),
      Number(params.invitationId),
      auth.getUserOrFail()
    )
    return response.noContent()
  }

  async accept({ auth, request, response }: HttpContext) {
    const { token } = await request.validateUsing(acceptOrganizationInvitationValidator)
    const result = await this.invitationService.accept(token, auth.getUserOrFail())
    return response.ok(result)
  }
}
