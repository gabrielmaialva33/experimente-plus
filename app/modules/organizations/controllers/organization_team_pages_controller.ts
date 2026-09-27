import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { DateTime } from 'luxon'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import OrganizationInvitationService from '#modules/organizations/services/organization_invitation_service'
import OrganizationMembershipService from '#modules/organizations/services/organization_membership_service'
import OrganizationResourceAuthorizationService from '#modules/organizations/services/organization_resource_authorization_service'
import OrganizationTeamPageService from '#modules/organizations/services/organization_team_page_service'
import {
  organizationRoleLabel,
  organizationTeamErrorMessage,
} from '#modules/organizations/utils/organization_team_messages'
import {
  createOrganizationInvitationValidator,
  updateOrganizationMemberValidator,
} from '#modules/organizations/validators/organization_validator'
import { setPrivateResponseHeaders } from '#shared/utils/private_response_headers'

/** Missing rows a stale page may point at; the organization itself stays a 404. */
const STALE_ROW_MESSAGES = new Set([
  'Organization member not found',
  'Organization invitation not found',
])

/**
 * "Equipe" in the partner Portal: thin Inertia actions over the same
 * membership and invitation services as `/api/v1/organizations/:id/...`.
 * Authorization stays in those services; this controller only turns the rules
 * a person can trip into pt-BR feedback on the team page.
 */
@inject()
export default class OrganizationTeamPagesController {
  constructor(
    private teamPages: OrganizationTeamPageService,
    private membershipService: OrganizationMembershipService,
    private invitationService: OrganizationInvitationService,
    private resourceAuthorization: OrganizationResourceAuthorizationService
  ) {}

  /**
   * "Equipe" in the Portal menu. One team goes straight to it; several are
   * listed; none returns to the overview with the reason.
   */
  async index({ auth, inertia, response, session, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)
    const actor = auth.getUserOrFail()
    const context = await this.resourceAuthorization.forActorContext(tenant!.id, actor)
    const chooser = await this.teamPages.chooser(tenant!.id, context)

    if (chooser.organizations.length === 1) {
      return response.redirect().toPath(this.teamPath(chooser.organizations[0].id))
    }
    if (chooser.organizations.length === 0) {
      session.flash(
        'warning',
        'Você ainda não participa da equipe de uma organização. Cadastre a sua ou aceite um convite.'
      )
      return response.redirect().toPath('/portal')
    }

    return inertia.render('portal/team/index', chooser)
  }

  async show({ auth, inertia, params, response, tenant }: HttpContext) {
    setPrivateResponseHeaders(response)
    const page = await this.teamPages.page(
      tenant!.id,
      Number(params.organizationId),
      auth.getUserOrFail()
    )

    return inertia.render('portal/organizations/team', page)
  }

  async invite({ auth, params, request, response, session, tenant }: HttpContext) {
    const organizationId = Number(params.organizationId)
    const payload = await request.validateUsing(createOrganizationInvitationValidator)

    return this.attempt(session, response, organizationId, async () => {
      const { invitation, email_sent: emailSent } = await this.invitationService.create(
        tenant!.id,
        organizationId,
        auth.getUserOrFail(),
        payload
      )
      const role = organizationRoleLabel(invitation.role)

      if (emailSent) {
        session.flash(
          'success',
          `Convite enviado para ${invitation.email} como ${role}. O link vale até ${this.brasiliaTime(invitation.expires_at)}.`
        )
      } else {
        session.flash(
          'warning',
          `Convite criado para ${invitation.email} como ${role}, mas o e-mail não pôde ser enviado. Tente “Reenviar” em alguns minutos.`
        )
      }
    })
  }

  async resendInvitation({ auth, params, response, session, tenant }: HttpContext) {
    const organizationId = Number(params.organizationId)

    return this.attempt(session, response, organizationId, async () => {
      const { invitation, email_sent: emailSent } = await this.invitationService.resend(
        tenant!.id,
        organizationId,
        Number(params.invitationId),
        auth.getUserOrFail()
      )

      if (emailSent) {
        session.flash(
          'success',
          `Convite reenviado para ${invitation.email}. O link anterior deixou de valer.`
        )
      } else {
        session.flash(
          'warning',
          `O convite de ${invitation.email} foi renovado, mas o e-mail não pôde ser enviado. Tente novamente em alguns minutos.`
        )
      }
    })
  }

  async cancelInvitation({ auth, params, response, session, tenant }: HttpContext) {
    const organizationId = Number(params.organizationId)

    return this.attempt(session, response, organizationId, async () => {
      await this.invitationService.revoke(
        tenant!.id,
        organizationId,
        Number(params.invitationId),
        auth.getUserOrFail()
      )
      session.flash('success', 'Convite cancelado. O link enviado deixou de funcionar.')
    })
  }

  async updateMember({ auth, params, request, response, session, tenant }: HttpContext) {
    const organizationId = Number(params.organizationId)
    const payload = await request.validateUsing(updateOrganizationMemberValidator)

    return this.attempt(session, response, organizationId, async () => {
      const member = await this.membershipService.update(
        tenant!.id,
        organizationId,
        Number(params.memberId),
        auth.getUserOrFail(),
        payload
      )
      session.flash('success', this.memberUpdatedMessage(member.user.full_name, payload, member))
    })
  }

  async removeMember({ auth, params, response, session, tenant }: HttpContext) {
    const organizationId = Number(params.organizationId)

    return this.attempt(session, response, organizationId, async () => {
      await this.membershipService.remove(
        tenant!.id,
        organizationId,
        Number(params.memberId),
        auth.getUserOrFail()
      )
      session.flash(
        'success',
        'Pessoa removida da equipe. Ela perdeu o acesso a esta organização e só volta com um novo convite.'
      )
    })
  }

  private memberUpdatedMessage(
    name: string,
    payload: IOrganization.MemberUpdatePayload,
    member: { role: IOrganization.Role; status: string }
  ): string {
    if (payload.status === 'suspended') {
      return `Acesso de ${name} suspenso. A pessoa continua na lista e pode ser reativada.`
    }
    if (payload.status === 'active' && payload.role === undefined) {
      return `Acesso de ${name} reativado.`
    }
    return `${name} agora é ${organizationRoleLabel(member.role)} nesta organização.`
  }

  /**
   * Runs one team action and returns to the team page. Domain rules become a
   * flashed pt-BR error; authorization failures and an unknown organization
   * keep their status, as they do on every Portal page.
   */
  private async attempt(
    session: HttpContext['session'],
    response: HttpContext['response'],
    organizationId: number,
    action: () => Promise<void>
  ) {
    try {
      await action()
    } catch (error) {
      const staleRow = error instanceof NotFoundException && STALE_ROW_MESSAGES.has(error.message)
      if (!(error instanceof BadRequestException) && !staleRow) {
        throw error
      }

      session.flash('error', organizationTeamErrorMessage((error as Error).message))
    }

    return response.redirect().toPath(this.teamPath(organizationId))
  }

  private brasiliaTime(value: DateTime): string {
    return value.setZone('America/Sao_Paulo').setLocale('pt-BR').toFormat("dd/MM 'às' HH:mm")
  }

  private teamPath(organizationId: number): string {
    return `/portal/organizations/${organizationId}/team`
  }
}
