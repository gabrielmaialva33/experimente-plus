import router from '@adonisjs/core/services/router'

import { throttle } from '#start/limiter'

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
