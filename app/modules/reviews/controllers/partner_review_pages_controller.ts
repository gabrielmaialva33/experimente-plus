import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import BadRequestException from '#exceptions/bad_request_exception'
import OrganizationResourceAuthorizationService from '#modules/organizations/services/organization_resource_authorization_service'
import PartnerPortalService from '#modules/portal/services/partner_portal_service'
import { readablePlacesFromOverview } from '#modules/portal/services/portal_overview_projection'
import type IReview from '#modules/reviews/interfaces/review_interface'
import EstablishmentReviewReplyService from '#modules/reviews/services/establishment_review_reply_service'
import PartnerReviewService from '#modules/reviews/services/partner_review_service'
import {
  partnerReplyFormValidator,
  partnerReplyMessages,
  partnerReviewsQueryValidator,
} from '#modules/reviews/validators/partner_review_validator'
import { reviewReplyParamsValidator } from '#modules/reviews/validators/review_validator'

/**
 * The partner's Avaliações page — Anexo I items 3 and 8: "Parceiro poderá …
 * responder avaliações".
 *
 * Until this page the answer existed only as the write endpoints under
 * `/api/v1/portal/reviews`, with no listing and no screen. Reading goes through the portal's own
 * authorization snapshot; answering goes through the same
 * `EstablishmentReviewReplyService` as that API, which resolves the
 * organization policy again, so the page is never a second door.
 */
@inject()
export default class PartnerReviewPagesController {
  constructor(
    private resourceAuthorization: OrganizationResourceAuthorizationService,
    private portalService: PartnerPortalService,
    private partnerReviews: PartnerReviewService,
    private replies: EstablishmentReviewReplyService
  ) {}

  async index({ auth, inertia, request, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const actor = auth.getUserOrFail()
    const query = await partnerReviewsQueryValidator.validate(request.qs())
    const context = await this.resourceAuthorization.forActorContext(tenant!.id, actor)
    const overview = await this.portalService.overview(tenant!.id, actor, context)
    const props = await this.partnerReviews.page(
      tenant!.id,
      readablePlacesFromOverview(overview),
      query
    )

    return inertia.render('portal/reviews/index', props)
  }

  async reply({ auth, params, request, response, session, tenant }: HttpContext) {
    const { reviewId } = await reviewReplyParamsValidator.validate(params)
    const payload = await request.validateUsing(partnerReplyFormValidator, {
      messagesProvider: partnerReplyMessages,
    })

    let status: IReview.ReplyStatus
    try {
      const reply = await this.replies.reply(tenant!.id, reviewId, auth.getUserOrFail(), payload)
      status = reply.status
    } catch (error) {
      // The only rule a partner can trip here is answering twice, when the
      // page was open in two tabs. Authorization failures keep their status.
      if (error instanceof BadRequestException) {
        session.flash(
          'error',
          'Esta avaliação já tem resposta. Atualize a página para editar a resposta publicada.'
        )
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', this.sentMessage(status))
    return response.redirect().back()
  }

  async updateReply({ auth, params, request, response, session, tenant }: HttpContext) {
    const { reviewId } = await reviewReplyParamsValidator.validate(params)
    const payload = await request.validateUsing(partnerReplyFormValidator, {
      messagesProvider: partnerReplyMessages,
    })
    const reply = await this.replies.updateReply(
      tenant!.id,
      reviewId,
      auth.getUserOrFail(),
      payload
    )

    session.flash('success', this.sentMessage(reply.status))
    return response.redirect().back()
  }

  /** A reply an automatic rule holds is not public yet, and the partner is told so. */
  private sentMessage(status: IReview.ReplyStatus) {
    return status === 'published'
      ? 'Resposta publicada. Ela aparece abaixo da avaliação, no app e no site.'
      : 'Resposta enviada. A moderação vai conferir antes de ela aparecer.'
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
