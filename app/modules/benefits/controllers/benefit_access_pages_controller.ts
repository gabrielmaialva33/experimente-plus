import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

import BenefitAccessService from '#modules/benefits/services/benefit_access_service'
import BenefitEditionService from '#modules/benefits/services/benefit_edition_service'
import {
  grantBenefitAccessValidator,
  revokeBenefitAccessValidator,
} from '#modules/benefits/validators/benefit_access_validator'

@inject()
export default class BenefitAccessPagesController {
  constructor(
    private accessService: BenefitAccessService,
    private editionService: BenefitEditionService
  ) {}

  async index({ auth, inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const actor = auth.getUserOrFail()
    const accesses = await this.accessService.list(tenant!.id, actor)
    const editions = await this.editionService.list(tenant!.id, actor)
    const now = DateTime.utc()

    return inertia.render('backoffice/benefits/accesses', {
      accesses: accesses.map((access) => ({
        id: access.id,
        source: access.source,
        status: access.status,
        external_reference: access.external_reference,
        notes: access.notes,
        granted_at: access.granted_at.toISO(),
        revoked_at: access.revoked_at?.toISO() ?? null,
        revocation_reason: access.revocation_reason,
        holder: {
          id: access.holder.id,
          email: access.holder.email,
        },
        edition: {
          id: access.edition.id,
          name: access.edition.name,
          status: access.edition.status,
          usage_starts_at: access.edition.usage_starts_at.toISO(),
          usage_ends_at: access.edition.usage_ends_at.toISO(),
          city: {
            id: access.edition.city.id,
            name: access.edition.city.name,
            state_code: access.edition.city.state_code,
          },
        },
      })),
      editions: editions
        .filter(
          (edition) =>
            ['published', 'paused'].includes(edition.status) && edition.usage_ends_at > now
        )
        .map((edition) => ({
          id: edition.id,
          name: edition.name,
          status: edition.status,
          usage_starts_at: edition.usage_starts_at.toISO(),
          usage_ends_at: edition.usage_ends_at.toISO(),
          city: {
            id: edition.city.id,
            name: edition.city.name,
            state_code: edition.city.state_code,
          },
        })),
    })
  }

  async store({ auth, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(grantBenefitAccessValidator)
    await this.accessService.grant(tenant!.id, auth.getUserOrFail(), payload)
    session.flash('success', 'Acesso concedido. A edição já aparece na carteira do usuário.')
    return response.redirect().back()
  }

  async revoke({ auth, params, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(revokeBenefitAccessValidator)
    await this.accessService.revoke(
      tenant!.id,
      Number(params.accessId),
      auth.getUserOrFail(),
      payload
    )
    session.flash('success', 'Acesso revogado com o histórico preservado.')
    return response.redirect().back()
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
