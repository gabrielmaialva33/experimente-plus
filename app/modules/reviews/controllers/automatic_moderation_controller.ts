import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import AutomaticModerationService from '#modules/reviews/services/automatic_moderation_service'
import { updateAutomaticModerationPolicyValidator } from '#modules/reviews/validators/automatic_moderation_validator'

/** The operation's automatic moderation rules — ADR-0031. Platform admins only. */
@inject()
export default class AutomaticModerationController {
  constructor(private automod: AutomaticModerationService) {}

  async show({ auth, tenant }: HttpContext) {
    return this.automod.getPolicy(tenant!.id, auth.getUserOrFail())
  }

  async update({ auth, request, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateAutomaticModerationPolicyValidator)
    return this.automod.updatePolicy(tenant!.id, auth.getUserOrFail(), payload)
  }
}
