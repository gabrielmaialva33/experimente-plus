import { inject } from '@adonisjs/core'
import { errors } from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'

import AutomaticModerationService from '#modules/reviews/services/automatic_moderation_service'
import ReviewPolicyService from '#modules/reviews/services/review_policy_service'
import { updateAutomaticModerationPolicyValidator } from '#modules/reviews/validators/automatic_moderation_validator'
import { updateReviewPolicyValidator } from '#modules/reviews/validators/review_validator'

/**
 * The review rules of the operation — Anexo I items 8 and 12.
 *
 * The values themselves are pending with the contracting party (Anexo I item
 * 15); this screen exists so an administrator can set them once they are
 * decided, instead of that decision waiting on a developer and an API call.
 * It delegates to the same service as `/api/v1/admin/review-policy`, so the
 * platform-admin requirement and the range check apply identically.
 *
 * The automatic moderation rules of ADR-0031 live on the same screen. Anexo I
 * item 12 names them in one breath — "regras e parâmetros implementados para
 * avaliações e moderação" — and an operator looking for "the rules" should not
 * have to know that two services hold them.
 */
@inject()
export default class ReviewPolicyPagesController {
  constructor(
    private policies: ReviewPolicyService,
    private automod: AutomaticModerationService
  ) {}

  async show({ auth, inertia, response, tenant }: HttpContext) {
    this.setPrivateHeaders(response)
    const actor = auth.getUserOrFail()
    const policy = await this.policies.getPolicy(tenant!.id, actor)
    const rules = await this.automod.getPolicy(tenant!.id, actor)
    return inertia.render('backoffice/review_policy/index', {
      policy: policy.serialize(),
      moderation_rules: {
        link_mode: rules.link_mode,
        contact_mode: rules.contact_mode,
        payment_data_mode: rules.payment_data_mode,
        blocked_term_mode: rules.blocked_term_mode,
        // A textarea holds one term per line; the list is rebuilt on the way back.
        blocked_terms_text: rules.blocked_terms.join('\n'),
      },
    })
  }

  async update({ auth, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateReviewPolicyValidator)
    await this.policies.updatePolicy(tenant!.id, auth.getUserOrFail(), payload)
    session.flash('success', 'Regras de avaliação atualizadas.')
    return response.redirect().back()
  }

  /**
   * The screen sends the blocked terms as the text of a textarea. They are
   * split into a list here and then passed through the very validator the API
   * uses, so a term the API would refuse is refused here too — the page is
   * never a looser door than the endpoint it sits beside.
   */
  async updateModerationRules({ auth, request, response, session, tenant }: HttpContext) {
    const input = request.only([
      'link_mode',
      'contact_mode',
      'payment_data_mode',
      'blocked_term_mode',
      'blocked_terms_text',
    ])
    const text = typeof input.blocked_terms_text === 'string' ? input.blocked_terms_text : null
    const payload = await this.validateRules({
      link_mode: input.link_mode,
      contact_mode: input.contact_mode,
      payment_data_mode: input.payment_data_mode,
      blocked_term_mode: input.blocked_term_mode,
      ...(text === null
        ? {}
        : {
            blocked_terms: text
              .split(/\r?\n/)
              .map((term: string) => term.trim())
              .filter(Boolean),
          }),
    })
    await this.automod.updatePolicy(tenant!.id, auth.getUserOrFail(), payload)
    session.flash('success', 'Regras de moderação automática atualizadas.')
    return response.redirect().back()
  }

  /**
   * The API validator names a refused term by its position in the list
   * (`blocked_terms.3`). The screen has a single textarea, so the error is
   * moved onto it; otherwise the page would refuse the save without saying
   * where.
   */
  private async validateRules(data: Record<string, unknown>) {
    try {
      return await updateAutomaticModerationPolicyValidator.validate(data)
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        const messages = (error.messages as Array<{ field: string }>).map((message) =>
          message.field.startsWith('blocked_terms')
            ? { ...message, field: 'blocked_terms_text' }
            : message
        )
        throw new errors.E_VALIDATION_ERROR(messages)
      }
      throw error
    }
  }

  private setPrivateHeaders(response: HttpContext['response']): void {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
  }
}
