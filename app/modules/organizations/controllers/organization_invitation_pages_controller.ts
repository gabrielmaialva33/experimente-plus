import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import OrganizationInvitationService from '#modules/organizations/services/organization_invitation_service'
import {
  forgetInvitationToken,
  pendingInvitationToken,
  rememberInvitationToken,
} from '#modules/organizations/utils/organization_invitation_session'
import {
  organizationRoleLabel,
  organizationTeamErrorMessage,
} from '#modules/organizations/utils/organization_team_messages'
import { ORGANIZATION_INVITATION_ACCEPT_PATH } from '#modules/web/utils/return_path'
import { setPrivateResponseHeaders } from '#shared/utils/private_response_headers'

/**
 * The page the invitation e-mail links to. Signed out, it explains the
 * invitation and offers sign-in or sign-up returning here; signed in with the
 * invited address, it accepts through the same service as the API.
 */
@inject()
export default class OrganizationInvitationPagesController {
  constructor(private invitationService: OrganizationInvitationService) {}

  async show({ auth, inertia, request, response, session }: HttpContext) {
    setPrivateResponseHeaders(response)

    // Arriving from the e-mail: keep the token in the session and drop it
    // from the address bar before anything renders.
    const queryToken = request.qs().token
    if (queryToken !== undefined) {
      rememberInvitationToken(session, queryToken)
      return response.redirect().toPath(ORGANIZATION_INVITATION_ACCEPT_PATH)
    }

    const guard = auth.use('jwt')
    const viewer = (await guard.check()) ? (guard.user ?? null) : null
    const preview = await this.invitationService.preview(pendingInvitationToken(session), viewer)

    return inertia.render('organization_invitations/accept', preview)
  }

  async accept({ auth, response, session }: HttpContext) {
    const actor = auth.getUserOrFail()
    const token = pendingInvitationToken(session)
    if (!token) {
      session.flash(
        'error',
        'Não encontramos o convite nesta sessão. Abra novamente o link recebido por e-mail.'
      )
      return response.redirect().toPath(ORGANIZATION_INVITATION_ACCEPT_PATH)
    }

    let result: Awaited<ReturnType<OrganizationInvitationService['accept']>>
    try {
      result = await this.invitationService.accept(token, actor)
    } catch (error) {
      if (!(error instanceof BadRequestException) && !(error instanceof NotFoundException)) {
        throw error
      }

      session.flash('error', organizationTeamErrorMessage(error.message))
      return response.redirect().toPath(ORGANIZATION_INVITATION_ACCEPT_PATH)
    }

    forgetInvitationToken(session)
    // The invitation may belong to another operation than the one in use:
    // continue in the operation where the membership now exists.
    await auth.use('jwt').generate(actor, { tenantId: result.tenant_id })
    session.flash(
      'success',
      `Convite aceito. Você agora faz parte de ${result.organization.trade_name} como ${organizationRoleLabel(result.role)}.`
    )

    return response.redirect().toPath(`/portal/organizations/${result.organization.id}`)
  }
}
