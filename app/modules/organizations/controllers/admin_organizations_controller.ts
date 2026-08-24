import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import OrganizationWorkflowService from '#modules/organizations/services/organization_workflow_service'
import {
  listOrganizationsValidator,
  reviewDecisionValidator,
} from '#modules/organizations/validators/organization_validator'

@inject()
export default class AdminOrganizationsController {
  constructor(private workflowService: OrganizationWorkflowService) {}

  async index({ auth, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listOrganizationsValidator)
    const organizations = await this.workflowService.listForReview(
      tenant!.id,
      auth.getUserOrFail(),
      query.status
    )
    return response.ok(organizations)
  }

  async approve(ctx: HttpContext) {
    return this.review(ctx, 'approve')
  }

  async requestChanges(ctx: HttpContext) {
    return this.review(ctx, 'requestChanges')
  }

  async reject(ctx: HttpContext) {
    return this.review(ctx, 'reject')
  }

  async suspend(ctx: HttpContext) {
    return this.review(ctx, 'suspend')
  }

  async restore(ctx: HttpContext) {
    return this.review(ctx, 'restore')
  }

  async archive(ctx: HttpContext) {
    return this.review(ctx, 'archive')
  }

  private async review(
    { auth, params, request, response, tenant }: HttpContext,
    action: 'approve' | 'requestChanges' | 'reject' | 'suspend' | 'restore' | 'archive'
  ) {
    const { reason } = await request.validateUsing(reviewDecisionValidator)
    const organization = await this.workflowService[action](
      tenant!.id,
      Number(params.id),
      auth.getUserOrFail(),
      reason
    )
    return response.ok(organization)
  }
}
