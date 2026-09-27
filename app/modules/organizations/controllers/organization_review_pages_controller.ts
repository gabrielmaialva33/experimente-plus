import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BadRequestException from '#exceptions/bad_request_exception'
import OrganizationClaimService from '#modules/organizations/services/organization_claim_service'
import OrganizationReviewPageService from '#modules/organizations/services/organization_review_page_service'
import OrganizationWorkflowService from '#modules/organizations/services/organization_workflow_service'
import { organizationReviewErrorMessage } from '#modules/organizations/utils/organization_review_messages'
import {
  listOrganizationsValidator,
  reviewDecisionValidator,
} from '#modules/organizations/validators/organization_validator'

type OrganizationDecision = 'approve' | 'requestChanges' | 'reject'
type ClaimDecision = 'approve' | 'reject'

const QUEUE_PATH = '/backoffice/organizations'

const DECISION_MESSAGES: Record<OrganizationDecision, string> = {
  approve: 'Organização aprovada. O negócio já pode enviar os lugares para a moderação.',
  requestChanges: 'Correções pedidas. O negócio vê o motivo no Portal e pode enviar de novo.',
  reject: 'Organização rejeitada. O motivo fica visível para o negócio no Portal.',
}

const CLAIM_MESSAGES: Record<ClaimDecision, string> = {
  approve: 'Reivindicação aprovada. A pessoa agora é proprietária da organização.',
  reject: 'Reivindicação recusada. O motivo fica registrado no histórico.',
}

/**
 * The back-office "Organizações" queue (Caixa de moderação). Each route
 * carries the permission of its `/api/v1/admin/organizations` or
 * `/organization-claims` counterpart, and each action calls the same service
 * method, so the page is never a wider door than the API; the services check
 * the platform policy again and write the same audit entries.
 */
@inject()
export default class OrganizationReviewPagesController {
  constructor(
    private pages: OrganizationReviewPageService,
    private workflowService: OrganizationWorkflowService,
    private claimService: OrganizationClaimService
  ) {}

  async index({ auth, inertia, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listOrganizationsValidator)
    const page = await this.pages.queue(
      tenant!.id,
      auth.getUserOrFail(),
      query.status ?? 'pending_review'
    )

    this.privateHeaders(response)
    return inertia.render('backoffice/organizations/index', page)
  }

  async show({ auth, inertia, params, response, tenant }: HttpContext) {
    const page = await this.pages.show(
      tenant!.id,
      Number(params.organizationId),
      auth.getUserOrFail()
    )

    this.privateHeaders(response)
    return inertia.render('backoffice/organizations/show', page)
  }

  async approve(ctx: HttpContext) {
    return this.decide(ctx, 'approve')
  }

  async requestChanges(ctx: HttpContext) {
    return this.decide(ctx, 'requestChanges')
  }

  async reject(ctx: HttpContext) {
    return this.decide(ctx, 'reject')
  }

  async approveClaim(ctx: HttpContext) {
    return this.decideClaim(ctx, 'approve')
  }

  async rejectClaim(ctx: HttpContext) {
    return this.decideClaim(ctx, 'reject')
  }

  private async decide(
    { auth, params, request, response, session, tenant }: HttpContext,
    decision: OrganizationDecision
  ) {
    const { reason } = await request.validateUsing(reviewDecisionValidator)
    const organizationId = Number(params.organizationId)

    try {
      await this.workflowService[decision](tenant!.id, organizationId, auth.getUserOrFail(), reason)
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error
      session.flash('error', organizationReviewErrorMessage(error.message))
      return response.redirect().toPath(`${QUEUE_PATH}/${organizationId}`)
    }

    session.flash('success', DECISION_MESSAGES[decision])
    return response.redirect().toPath(QUEUE_PATH)
  }

  private async decideClaim(
    { auth, params, request, response, session, tenant }: HttpContext,
    decision: ClaimDecision
  ) {
    const { reason } = await request.validateUsing(reviewDecisionValidator)

    try {
      await this.claimService[decision](
        tenant!.id,
        Number(params.claimId),
        auth.getUserOrFail(),
        reason
      )
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error
      session.flash('error', organizationReviewErrorMessage(error.message))
      return response.redirect().toPath(QUEUE_PATH)
    }

    session.flash('success', CLAIM_MESSAGES[decision])
    return response.redirect().toPath(QUEUE_PATH)
  }

  private privateHeaders(response: HttpContext['response']) {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
