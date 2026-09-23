import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import UserBanService from '#modules/reviews/services/user_ban_service'
import {
  banPayloadValidator,
  unbanPayloadValidator,
  userIdParamsValidator,
} from '#modules/reviews/validators/review_validator'

/** Bans within the calling operation — ADR-0027 §6. */
@inject()
export default class UserBansController {
  constructor(private bans: UserBanService) {}

  async show({ auth, params, tenant }: HttpContext) {
    const { userId } = await userIdParamsValidator.validate(params)
    const actor = auth.getUserOrFail()
    return {
      state: await this.bans.state(tenant!.id, actor, userId),
      history: await this.bans.history(tenant!.id, actor, userId),
    }
  }

  async ban({ auth, params, request, tenant }: HttpContext) {
    const { userId } = await userIdParamsValidator.validate(params)
    const payload = await request.validateUsing(banPayloadValidator)
    return this.bans.ban(tenant!.id, auth.getUserOrFail(), userId, payload)
  }

  async unban({ auth, params, request, tenant }: HttpContext) {
    const { userId } = await userIdParamsValidator.validate(params)
    const payload = await request.validateUsing(unbanPayloadValidator)
    return this.bans.unban(tenant!.id, auth.getUserOrFail(), userId, payload)
  }
}
