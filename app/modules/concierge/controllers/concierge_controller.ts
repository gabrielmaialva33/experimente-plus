import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import { conciergeAskValidator } from '#modules/concierge/validators/concierge_validator'
import ConciergeAskService from '#modules/concierge/services/concierge_ask_service'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

@inject()
export default class ConciergeController {
  constructor(
    private operationResolver: PublicOperationResolver,
    private asker: ConciergeAskService
  ) {}

  /**
   * Discovery assistance over the published catalogue — ADR-0029.
   *
   * Public like the rest of discovery, and read-only by construction: this
   * module has no write path, so it cannot reserve, purchase or confirm
   * anything, as the contracted scope requires.
   *
   * It never reads credentials. A token sent here is ignored rather than used,
   * so the public answer cannot depend on who asked; the personal variant is a
   * separate route under `/api/v1/me`, where the session is required.
   */
  async ask({ request, response }: HttpContext) {
    const payload = await request.validateUsing(conciergeAskValidator)
    const tenant = await this.operationResolver.resolve(request.hostname())

    return this.respond(response, await this.asker.askPublic(tenant.id, payload))
  }

  /**
   * The same assistant for a signed-in Explorer — Anexo I item 11, "com base
   * nos dados disponíveis e, quando aplicável, nos interesses do Explorador".
   *
   * The operation comes from the session, as for the rest of `/api/v1/me`;
   * the service decides what the person's interests may influence.
   */
  async askPersonal({ auth, request, response, tenant }: HttpContext) {
    const payload = await request.validateUsing(conciergeAskValidator)
    const user = auth.getUserOrFail()

    return this.respond(response, await this.asker.askPersonal(tenant!.id, user.id, payload))
  }

  private respond(response: HttpContext['response'], body: IConcierge.RouteReply) {
    // Never cached: the answer depends on the question, and a shared cache
    // would hand one consumer's reply to another. The personal route already
    // carries `private, no-store` from its middleware, which must not be
    // weakened here.
    if (!response.getHeader('cache-control')) {
      response.header('cache-control', 'no-store')
    }
    return response.ok(body)
  }
}
