import router from '@adonisjs/core/services/router'

import { middleware } from '#start/kernel'
import { apiThrottle, throttle } from '#start/limiter'
import { privateResponseHeadersMiddleware } from '#shared/utils/private_response_headers'

const PartnerContentController = () =>
  import('#modules/partner_content/controllers/partner_content_controller')
const PartnerContentMediaController = () =>
  import('#modules/partner_content/controllers/partner_content_media_controller')

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

/**
 * The agenda of a city.
 *
 * It is registered here, not in `catalog/routes.ts`, so the partner-content
 * surfaces keep a single owner: the payload, its windows and its ordering are
 * decided by this module, and splitting the prefix across two files is how two
 * owners of the same contract start to drift.
 */
router
  .get('/api/v1/catalog/cities/:citySlug/agenda', [PartnerContentController, 'cityAgenda'])
  .as('catalog.city.agenda')
  .use(throttle)

router
  .group(() => {
    router.get('/:kind', [PartnerContentController, 'index'])
    router.post('/:kind', [PartnerContentController, 'store'])
    router.put('/:kind/:id', [PartnerContentController, 'update'])
    router.post('/:kind/:id/submit', [PartnerContentController, 'submit'])
    router.post('/:kind/:id/archive', [PartnerContentController, 'archive'])
    router.get('/:kind/:id/media', [PartnerContentMediaController, 'index'])
    router.post('/:kind/:id/media', [PartnerContentMediaController, 'store'])
    router.patch('/:kind/:id/media/:mediaId', [PartnerContentMediaController, 'update'])
    router.patch('/:kind/:id/media/:mediaId/cover', [PartnerContentMediaController, 'cover'])
    router.delete('/:kind/:id/media/:mediaId', [PartnerContentMediaController, 'destroy'])
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
    // Administrative edit and the append-only history — ADR-0028 §4.
    router.put('/content/:kind/:id', [PartnerContentController, 'moderationUpdate'])
    router.get('/content/:kind/:id/history', [PartnerContentController, 'history'])
    router.post('/content/:kind/:id/media/:mediaId/approve', [
      PartnerContentMediaController,
      'approve',
    ])
    router.post('/content/:kind/:id/media/:mediaId/reject', [
      PartnerContentMediaController,
      'reject',
    ])
    router.post('/content/:kind/:id/media/:mediaId/quarantine', [
      PartnerContentMediaController,
      'quarantine',
    ])
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
