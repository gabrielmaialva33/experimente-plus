import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import EstablishmentAddressService from '#modules/establishments/services/establishment_address_service'
import EstablishmentAttributesService from '#modules/establishments/services/establishment_attributes_service'
import EstablishmentCategoriesService from '#modules/establishments/services/establishment_categories_service'
import EstablishmentHoursService from '#modules/establishments/services/establishment_hours_service'
import EstablishmentRevisionCloneService from '#modules/establishments/services/establishment_revision_clone_service'
import EstablishmentService from '#modules/establishments/services/establishment_service'
import EstablishmentSubmissionService from '#modules/establishments/services/establishment_submission_service'
import {
  createEstablishmentValidator,
  replaceEstablishmentAddressValidator,
  replaceEstablishmentAttributesValidator,
  replaceEstablishmentCategoriesValidator,
  replaceEstablishmentHoursValidator,
  updateEstablishmentRevisionValidator,
} from '#modules/establishments/validators/establishment_validator'
import { createEstablishmentRevisionValidator } from '#modules/establishments/validators/establishment_review_validator'
import OrganizationService from '#modules/organizations/services/organization_service'
import OrganizationResourceAuthorizationService from '#modules/organizations/services/organization_resource_authorization_service'
import OrganizationWorkflowService from '#modules/organizations/services/organization_workflow_service'
import {
  createOrganizationValidator,
  updateOrganizationValidator,
} from '#modules/organizations/validators/organization_validator'
import PilotFeedbackService from '#modules/pilot_feedback/services/pilot_feedback_service'
import { createPilotFeedbackValidator } from '#modules/pilot_feedback/validators/pilot_feedback_validator'
import PartnerPortalService from '#modules/portal/services/partner_portal_service'

@inject()
export default class PartnerPortalController {
  constructor(
    private portalService: PartnerPortalService,
    private resourceAuthorization: OrganizationResourceAuthorizationService,
    private organizationService: OrganizationService,
    private organizationWorkflowService: OrganizationWorkflowService,
    private establishmentService: EstablishmentService,
    private addressService: EstablishmentAddressService,
    private attributesService: EstablishmentAttributesService,
    private categoriesService: EstablishmentCategoriesService,
    private hoursService: EstablishmentHoursService,
    private revisionCloneService: EstablishmentRevisionCloneService,
    private submissionService: EstablishmentSubmissionService,
    private feedbackService: PilotFeedbackService
  ) {}

  async index({ auth, inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const actor = auth.getUserOrFail()
    const authorizationContext = await this.resourceAuthorization.forActorContext(tenant!.id, actor)
    const overview = await this.portalService.overview(tenant!.id, actor, authorizationContext)
    const feedbackTargets = this.portalService.feedbackTargetsFromOverview(overview)

    return inertia.render('portal/index', {
      overview,
      feedback_targets: feedbackTargets,
      allowed_actions: authorizationContext.allowed_actions,
    })
  }

  async newOrganization({ inertia, response }: HttpContext) {
    this.setPrivateHeaders(response)
    return inertia.render('portal/organizations/new', {})
  }

  async createOrganization({ auth, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(createOrganizationValidator)
    const organization = await this.organizationService.create(
      tenant!.id,
      auth.getUserOrFail(),
      payload
    )

    session.flash('success', 'Organização criada. Complete os dados e envie para análise.')
    return response.redirect().toPath(`/portal/organizations/${organization.id}`)
  }

  async organization({ auth, inertia, params, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const actor = auth.getUserOrFail()
    const organizationId = Number(params.organizationId)
    const authorizationContext = await this.resourceAuthorization.forActorContext(tenant!.id, actor)
    const organization = await this.portalService.organization(
      tenant!.id,
      organizationId,
      authorizationContext
    )
    const feedbackTargets = this.portalService.feedbackTargetsFromOrganization(organization)

    return inertia.render('portal/organizations/show', {
      organization,
      feedback_targets: feedbackTargets,
      allowed_actions: organization.allowed_actions,
    })
  }

  async updateOrganization({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateOrganizationValidator)
    await this.organizationService.update(
      tenant!.id,
      Number(params.organizationId),
      auth.getUserOrFail(),
      payload
    )

    session.flash('success', 'Dados da organização atualizados.')
    return response.redirect().back()
  }

  async submitOrganization({ auth, response, session, params, tenant }: HttpContext) {
    await this.organizationWorkflowService.submit(
      tenant!.id,
      Number(params.organizationId),
      auth.getUserOrFail()
    )

    session.flash('success', 'Organização enviada para análise.')
    return response.redirect().back()
  }

  async newEstablishment({ auth, inertia, params, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const actor = auth.getUserOrFail()
    const organizationId = Number(params.organizationId)
    const organization = await this.establishmentService.authorizeCreateForOrganization(
      tenant!.id,
      organizationId,
      actor
    )
    const options = await this.portalService.creationOptions(tenant!.id)

    return inertia.render('portal/establishments/new', {
      organization: { id: organization.id, trade_name: organization.trade_name },
      ...options,
    })
  }

  async createEstablishment({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(createEstablishmentValidator)
    const establishment = await this.establishmentService.create(
      tenant!.id,
      Number(params.organizationId),
      auth.getUserOrFail(),
      payload
    )

    const establishmentId = Number((establishment as unknown as { id: number }).id)

    session.flash('success', 'Unidade criada. Continue preenchendo a ficha antes de submeter.')
    return response.redirect().toPath(`/portal/establishments/${establishmentId}`)
  }

  async establishment({ auth, inertia, params, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const actor = auth.getUserOrFail()
    const authorizationContext = await this.resourceAuthorization.forActorContext(tenant!.id, actor)
    const editor = await this.portalService.establishmentEditor(
      tenant!.id,
      Number(params.establishmentId),
      authorizationContext
    )

    return inertia.render('portal/establishments/edit', {
      ...editor,
      tenant_id: tenant!.id,
    })
  }

  async updateIdentity({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateEstablishmentRevisionValidator)
    await this.establishmentService.updateRevision(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail(),
      payload
    )

    session.flash('success', 'Identidade pública atualizada.')
    return response.redirect().back()
  }

  async updateAddress({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(replaceEstablishmentAddressValidator)
    await this.addressService.replace(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail(),
      payload
    )

    session.flash('success', 'Endereço atualizado.')
    return response.redirect().back()
  }

  async updateCategories({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(replaceEstablishmentCategoriesValidator)
    await this.categoriesService.replace(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail(),
      payload.categories
    )

    session.flash('success', 'Categorias atualizadas.')
    return response.redirect().back()
  }

  async updateAttributes({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(replaceEstablishmentAttributesValidator)
    await this.attributesService.replace(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail(),
      payload.attributes
    )

    session.flash('success', 'Características da unidade atualizadas.')
    return response.redirect().back()
  }

  async updateHours({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(replaceEstablishmentHoursValidator)
    await this.hoursService.replaceWeekly(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail(),
      payload.hours
    )

    session.flash('success', 'Horários atualizados.')
    return response.redirect().back()
  }

  async feedback({ auth, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(createPilotFeedbackValidator)
    await this.feedbackService.create(tenant!.id, auth.getUserOrFail(), payload)

    session.flash('success', 'Obrigado. Seu feedback foi registrado para o piloto.')
    return response.redirect().back()
  }

  async submit({ auth, response, session, params, tenant }: HttpContext) {
    const result = await this.submissionService.submit(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail()
    )

    if (!result.submitted) {
      session.flash('errors', {
        submission:
          'A ficha ainda não está pronta. Revise as pendências indicadas antes de enviar.',
      })
      return response.redirect().back()
    }

    session.flash('success', 'Ficha enviada para moderação.')
    return response.redirect().back()
  }

  async createRevision({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(createEstablishmentRevisionValidator)
    await this.revisionCloneService.create(
      tenant!.id,
      Number(params.establishmentId),
      auth.getUserOrFail(),
      payload
    )

    session.flash(
      'success',
      payload.source === 'latest_terminal'
        ? 'Nova revisão criada. Continue os ajustes no novo rascunho.'
        : 'Nova revisão criada. A publicação atual continua disponível.'
    )
    return response.redirect().toPath(`/portal/establishments/${Number(params.establishmentId)}`)
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
