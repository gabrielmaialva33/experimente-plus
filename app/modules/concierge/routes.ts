import router from '@adonisjs/core/services/router'

import { middleware } from '#start/kernel'
import { apiThrottle, throttle } from '#start/limiter'
import { privateResponseHeadersMiddleware } from '#shared/utils/private_response_headers'

const ConciergeController = () => import('#modules/concierge/controllers/concierge_controller')

/**
 * Discovery is public (ADR-0003), and the Concierge is part of it. Only a read
 * route exists: the absence of any write path is what guarantees the module
 * cannot reserve, purchase or confirm, rather than an instruction to a model.
 */
router
  .post('/api/v1/catalog/concierge', [ConciergeController, 'ask'])
  .as('catalog.concierge.ask')
  .use(throttle)

/**
 * The personal variant — ADR-0029, revision of 23/09/2026. A route of its own
 * so the public one never has to read a credential; the session and the
 * operation come from the same middleware as the rest of `/api/v1/me`.
 */
router
  .post('/api/v1/me/concierge', [ConciergeController, 'askPersonal'])
  .as('me.concierge.ask')
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    apiThrottle,
    middleware.tenant({ required: true }),
  ])
