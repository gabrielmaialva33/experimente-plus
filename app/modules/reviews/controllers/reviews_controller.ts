import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ContentReportService from '#modules/reviews/services/content_report_service'
import EstablishmentReviewReplyService from '#modules/reviews/services/establishment_review_reply_service'
import EstablishmentReviewService from '#modules/reviews/services/establishment_review_service'
import ReviewPolicyService from '#modules/reviews/services/review_policy_service'
import {
  createReplyValidator,
  createReportValidator,
  createReviewValidator,
  establishmentReviewParamsValidator,
  listReportsQueryValidator,
  listReviewsQueryValidator,
  resolveReportValidator,
  reviewIdValidator,
  reviewReplyParamsValidator,
  updateReviewPolicyValidator,
  updateReviewValidator,
} from '#modules/reviews/validators/review_validator'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

@inject()
export default class ReviewsController {
  constructor(
    private reviewService: EstablishmentReviewService,
    private replyService: EstablishmentReviewReplyService,
    private reportService: ContentReportService,
    private policyService: ReviewPolicyService,
    private publicResolver: PublicOperationResolver
  ) {}

  async catalogReviews({ request, params }: HttpContext) {
    const { establishmentId } = await establishmentReviewParamsValidator.validate(params)
    const query = await request.validateUsing(listReviewsQueryValidator)
    const tenant = await this.publicResolver.resolve(request.hostname())
    return this.reviewService.listPublic(tenant.id, establishmentId, query)
  }

  async showPublic({ request, params }: HttpContext) {
    const { id } = await reviewIdValidator.validate(params)
    const tenant = await this.publicResolver.resolve(request.hostname())
    return this.reviewService.showPublic(tenant.id, id)
  }

  async myReviews({ tenant, auth, request }: HttpContext) {
    const query = await request.validateUsing(listReviewsQueryValidator)
    return this.reviewService.listMyReviews(tenant!.id, auth.getUserOrFail(), query)
  }

  async store({ tenant, auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createReviewValidator)
    const review = await this.reviewService.create(tenant!.id, auth.getUserOrFail(), payload)
    return response.created(review)
  }

  async update({ tenant, auth, params, request }: HttpContext) {
    const { id } = await reviewIdValidator.validate(params)
    const payload = await request.validateUsing(updateReviewValidator)
    return this.reviewService.update(tenant!.id, id, auth.getUserOrFail(), payload)
  }

  async destroy({ tenant, auth, params, response }: HttpContext) {
    const { id } = await reviewIdValidator.validate(params)
    await this.reviewService.delete(tenant!.id, id, auth.getUserOrFail())
    return response.noContent()
  }

  async reply({ tenant, auth, params, request, response }: HttpContext) {
    const { reviewId } = await reviewReplyParamsValidator.validate(params)
    const payload = await request.validateUsing(createReplyValidator)
    const result = await this.replyService.reply(
      tenant!.id,
      reviewId,
      auth.getUserOrFail(),
      payload
    )
    return response.created(result)
  }

  async updateReply({ tenant, auth, params, request }: HttpContext) {
    const { reviewId } = await reviewReplyParamsValidator.validate(params)
    const payload = await request.validateUsing(createReplyValidator)
    return this.replyService.updateReply(
      tenant!.id,
      reviewId,
      auth.getUserOrFail(),
      payload
    )
  }

  async report({ tenant, auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createReportValidator)
    const report = await this.reportService.createReport(
      tenant!.id,
      auth.getUserOrFail(),
      payload
    )
    return response.created(report)
  }

  async listReports({ tenant, auth, request }: HttpContext) {
    const query = await request.validateUsing(listReportsQueryValidator)
    return this.reportService.listReports(tenant!.id, auth.getUserOrFail(), query)
  }

  async resolveReport({ tenant, auth, params, request }: HttpContext) {
    const { id } = await reviewIdValidator.validate(params)
    const payload = await request.validateUsing(resolveReportValidator)
    return this.reportService.resolveReport(tenant!.id, id, auth.getUserOrFail(), payload)
  }

  async getPolicy({ tenant, auth }: HttpContext) {
    return this.policyService.getPolicy(tenant!.id, auth.getUserOrFail())
  }

  async updatePolicy({ tenant, auth, request }: HttpContext) {
    const payload = await request.validateUsing(updateReviewPolicyValidator)
    return this.policyService.updatePolicy(tenant!.id, auth.getUserOrFail(), payload)
  }
}
