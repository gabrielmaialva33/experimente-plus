import router from '@adonisjs/core/services/router'

import { middleware } from '#start/kernel'
import { apiThrottle, throttle } from '#start/limiter'
import { privateResponseHeadersMiddleware } from '#shared/utils/private_response_headers'

const PartnerContentController = () =>
  import('#modules/partner_content/controllers/partner_content_controller')

/**
 * Partner-owned content — ADR-0028.
 *
 * `kind` is a path segment rather than three route families because the three
 * kinds share one lifecycle; the validator rejects anything that is not one of
 * the three, so the segment is never trusted for being routable.
 */

// Public discovery, no session and no membership (ADR-0003).
router
  .get('/api/v1/catalog/establishments/:establishmentId/:kind', [
    PartnerContentController,
    'publicList',
  ])
  .where('kind', /^(experiences|events|showcase-items)$/)
  .use(throttle)

router
  .group(() => {
    router.get('/:kind', [PartnerContentController, 'index'])
    router.post('/:kind', [PartnerContentController, 'store'])
    router.put('/:kind/:id', [PartnerContentController, 'update'])
    router.post('/:kind/:id/submit', [PartnerContentController, 'submit'])
    router.post('/:kind/:id/archive', [PartnerContentController, 'archive'])
  })
  .prefix('/api/v1/portal/content')
  .where('kind', /^(experiences|events|showcase-items)$/)
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    apiThrottle,
    middleware.tenant({ required: true }),
  ])

router
  .group(() => {
    router.get('/content/:kind', [PartnerContentController, 'moderationIndex'])
    router.post('/content/:kind/:id/approve', [PartnerContentController, 'approve'])
    router.post('/content/:kind/:id/reject', [PartnerContentController, 'reject'])
    router.post('/content/:kind/:id/archive', [PartnerContentController, 'moderationArchive'])
    router.get('/partner-content-policy', [PartnerContentController, 'getPolicy'])
    router.put('/partner-content-policy', [PartnerContentController, 'updatePolicy'])
  })
  .prefix('/api/v1/admin')
  .where('kind', /^(experiences|events|showcase-items)$/)
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    apiThrottle,
    middleware.tenant({ required: true }),
  ])
