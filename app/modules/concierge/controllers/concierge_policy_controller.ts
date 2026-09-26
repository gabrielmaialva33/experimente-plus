import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ConciergePolicyService from '#modules/concierge/services/concierge_policy_service'
import { updateConciergePolicyValidator } from '#modules/concierge/validators/concierge_validator'

/** The operation's Concierge parameters — ADR-0029, revision of 26/09/2026. Platform admins only. */
@inject()
export default class ConciergePolicyController {
  constructor(private policies: ConciergePolicyService) {}

  async show({ auth, tenant }: HttpContext) {
    return this.policies.getPolicy(tenant!.id, auth.getUserOrFail())
  }

  async update({ auth, request, tenant }: HttpContext) {
    const payload = await request.validateUsing(updateConciergePolicyValidator)
    return this.policies.updatePolicy(tenant!.id, auth.getUserOrFail(), payload)
  }
}
