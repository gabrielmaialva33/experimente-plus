import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import EstablishmentModerationService from '#modules/establishments/services/establishment_moderation_service'
import {
  approveEstablishmentRevisionValidator,
  listEstablishmentReviewQueueValidator,
  rejectEstablishmentRevisionValidator,
  requestEstablishmentRevisionChangesValidator,
} from '#modules/establishments/validators/establishment_review_validator'
import PilotFeedbackService from '#modules/pilot_feedback/services/pilot_feedback_service'
import {
  listPilotFeedbackValidator,
  reviewPilotFeedbackValidator,
} from '#modules/pilot_feedback/validators/pilot_feedback_validator'

@inject()
export default class BackofficePortalController {
  constructor(
    private moderationService: EstablishmentModerationService,
    private feedbackService: PilotFeedbackService
  ) {}

  async moderation({ auth, inertia, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listEstablishmentReviewQueueValidator)
    const revisions = await this.moderationService.list(
      tenant!.id,
      {
        organization_id: query.organization_id,
        city_id: query.city_id,
        page: query.page ?? 1,
        per_page: query.per_page ?? 20,
      },
      auth.getUserOrFail()
    )

    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
    return inertia.render('backoffice/moderation/index', { revisions, filters: query })
  }

  async revision({ auth, inertia, params, response, tenant }: HttpContext) {
    const review = await this.moderationService.show(
      tenant!.id,
      Number(params.revisionId),
      auth.getUserOrFail()
    )

    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
    // Spread so the page receives revision, publication_gate, review_issues
    // and events as first-class props (same contract as the admin API).
    return inertia.render('backoffice/moderation/show', { ...review })
  }

  async approveRevision({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(approveEstablishmentRevisionValidator)
    const result = await this.moderationService.approve(
      tenant!.id,
      Number(params.revisionId),
      auth.getUserOrFail(),
      payload.reason
    )

    if (!result.approved) {
      const message = result.publication_gate.blocking_issues
        .map((issue) => issue.message)
        .join(' ')
      session.flash('errors', { moderation: message || 'A revisão não pôde ser aprovada.' })
      return response.redirect().back()
    }

    session.flash('success', 'Revisão aprovada e publicada.')
    return response.redirect().toPath('/backoffice/moderation')
  }

  async requestChanges({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(requestEstablishmentRevisionChangesValidator)
    await this.moderationService.requestChanges(
      tenant!.id,
      Number(params.revisionId),
      auth.getUserOrFail(),
      payload
    )

    session.flash('success', 'Correções solicitadas ao parceiro.')
    return response.redirect().toPath('/backoffice/moderation')
  }

  async rejectRevision({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(rejectEstablishmentRevisionValidator)
    await this.moderationService.reject(
      tenant!.id,
      Number(params.revisionId),
      auth.getUserOrFail(),
      payload.reason
    )

    session.flash('success', 'Revisão rejeitada com histórico preservado.')
    return response.redirect().toPath('/backoffice/moderation')
  }

  async feedback({ auth, inertia, request, response, tenant }: HttpContext) {
    const query = await request.validateUsing(listPilotFeedbackValidator)
    const feedback = await this.feedbackService.list(
      tenant!.id,
      {
        status: query.status,
        context: query.context,
        organization_id: query.organization_id,
        establishment_id: query.establishment_id,
        page: query.page ?? 1,
        per_page: query.per_page ?? 20,
      },
      auth.getUserOrFail()
    )

    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
    return inertia.render('backoffice/feedback/index', { feedback, filters: query })
  }

  async reviewFeedback({ auth, request, response, session, params, tenant }: HttpContext) {
    const payload = await request.validateUsing(reviewPilotFeedbackValidator)
    await this.feedbackService.review(
      tenant!.id,
      Number(params.feedbackId),
      auth.getUserOrFail(),
      payload
    )

    session.flash('success', 'Feedback atualizado.')
    return response.redirect().back()
  }
}
