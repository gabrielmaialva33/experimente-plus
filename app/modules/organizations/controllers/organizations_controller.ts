import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import OrganizationService from '#modules/organizations/services/organization_service'
import OrganizationWorkflowService from '#modules/organizations/services/organization_workflow_service'
import {
  createOrganizationValidator,
  reviewDecisionValidator,
  updateOrganizationValidator,
} from '#modules/organizations/validators/organization_validator'

@inject()
export default class OrganizationsController {
  constructor(
    private organizationService: OrganizationService,
    private workflowService: OrganizationWorkflowService
  ) {}

  async index({ auth, response, tenant }: HttpContext) {
    const organizations = await this.organizationService.list(tenant!.id, auth.getUserOrFail())
    return response.ok(organizations)
  }

  async store({ auth, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(createOrganizationValidator)
    const organization = await this.organizationService.create(
      tenant!.id,
      auth.getUserOrFail(),
      payload
    )
    return response.created(organization)
  }

  async show({ auth, params, response, tenant }: HttpContext) {
    const organization = await this.organizationService.show(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(organization)
  }

  async update({ auth, params, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateOrganizationValidator)
    const organization = await this.organizationService.update(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      payload
    )
    return response.ok(organization)
  }

  async submit({ auth, params, response, tenant }: HttpContext) {
    const organization = await this.workflowService.submit(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail()
    )
    return response.ok(organization)
  }

  async archive({ auth, params, request, response, tenant }: HttpContext) {
    const { reason } = await request.validateUsing(reviewDecisionValidator)
    const organization = await this.workflowService.archive(
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      reason
    )
    return response.ok(organization)
  }
}
