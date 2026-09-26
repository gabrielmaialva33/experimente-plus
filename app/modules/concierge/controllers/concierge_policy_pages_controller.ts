import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ConciergePolicyService from '#modules/concierge/services/concierge_policy_service'
import { updateConciergePolicyValidator } from '#modules/concierge/validators/concierge_validator'

/**
 * The Concierge screen of the backoffice — Anexo I item 12.
 *
 * The values are the operation's and pending with the contracting party
 * (Anexo I item 15); the screen exists so an administrator sets them once they
 * are decided. It delegates to the same service as
 * `/api/v1/admin/concierge-policy`, so the platform-admin requirement and the
 * ranges apply identically. The infrastructure is shown and never edited:
 * provider, models and key belong to the deployment, and the key is not even
 * read out — only whether one is present.
 */
@inject()
export default class ConciergePolicyPagesController {
  constructor(private policies: ConciergePolicyService) {}

  async show({ auth, inertia, response, tenant }: HttpContext) {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    response.header('Cache-Control', 'private, no-store')
    const actor = auth.getUserOrFail()
    const policy = await this.policies.getPolicy(tenant!.id, actor)
    const infrastructure = await this.policies.infrastructure(actor)

    return inertia.render('backoffice/concierge/index', {
      policy: {
        enabled: policy.enabled,
        max_catalog_items: policy.max_catalog_items,
        daily_questions_per_person: policy.daily_questions_per_person,
      },
      infrastructure,
    })
  }

  async update({ auth, request, response, session, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateConciergePolicyValidator)
    await this.policies.updatePolicy(tenant!.id, auth.getUserOrFail(), payload)
    session.flash('success', 'Configuração do Concierge atualizada.')
    return response.redirect().back()
  }
}
