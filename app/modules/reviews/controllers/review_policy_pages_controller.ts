import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ReviewPolicyService from '#modules/reviews/services/review_policy_service'
import { updateReviewPolicyValidator } from '#modules/reviews/validators/review_validator'

/**
 * The review rules of the operation — Anexo I items 8 and 12.
 *
 * The values themselves are pending with the contracting party (Anexo I item
 * 15); this screen exists so an administrator can set them once they are
 * decided, instead of that decision waiting on a developer and an API call.
 * It delegates to the same service as `/api/v1/admin/review-policy`, so the
 * platform-admin requirement and the range check apply identically.
 */
@inject()
export default class ReviewPolicyPagesController {
  constructor(private policies: ReviewPolicyService) {}

  async show({ auth, inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const policy = await this.policies.getPolicy(tenant!.id, auth.getUserOrFail())
    return inertia.render('backoffice/review_policy/index', { policy: policy.serialize() })
  }

  async update({ auth, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateReviewPolicyValidator)
    await this.policies.updatePolicy(tenant!.id, auth.getUserOrFail(), payload)
    session.flash('success', 'Regras de avaliação atualizadas.')
    return response.redirect().back()
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
