import router from '@adonisjs/core/services/router'

import { middleware } from '#start/kernel'

const EstablishmentMediaController = () =>
  import('#modules/media/controllers/establishment_media_controller')
const MediaModerationController = () =>
  import('#modules/media/controllers/media_moderation_controller')
const PublicEstablishmentMediaController = () =>
  import('#modules/media/controllers/public_establishment_media_controller')

function registerMediaRoutes(prefix: string, named: boolean): void {
  const indexRoute = router
    .get(`${prefix}/establishments/:id/media`, [EstablishmentMediaController, 'index'])
    .use(middleware.auth())
    .use(middleware.tenant({ required: true }))
    .use(middleware.permission({ resource: 'media', action: 'read' }))

  const storeRoute = router
    .post(`${prefix}/establishments/:id/media`, [EstablishmentMediaController, 'store'])
    .use(middleware.auth())
    .use(middleware.tenant({ required: true }))
    .use(middleware.permission({ resource: 'media', action: 'create' }))

  const updateRoute = router
    .patch(`${prefix}/establishments/:id/media/:mediaId`, [EstablishmentMediaController, 'update'])
    .use(middleware.auth())
    .use(middleware.tenant({ required: true }))
    .use(middleware.permission({ resource: 'media', action: 'update' }))

  const coverRoute = router
    .patch(`${prefix}/establishments/:id/media/:mediaId/cover`, [
      EstablishmentMediaController,
      'cover',
    ])
    .use(middleware.auth())
    .use(middleware.tenant({ required: true }))
    .use(middleware.permission({ resource: 'media', action: 'update' }))

  const orderRoute = router
    .put(`${prefix}/establishments/:id/media/order`, [EstablishmentMediaController, 'reorder'])
    .use(middleware.auth())
    .use(middleware.tenant({ required: true }))
    .use(middleware.permission({ resource: 'media', action: 'update' }))

  const destroyRoute = router
    .delete(`${prefix}/establishments/:id/media/:mediaId`, [
      EstablishmentMediaController,
      'destroy',
    ])
    .use(middleware.auth())
    .use(middleware.tenant({ required: true }))
    .use(middleware.permission({ resource: 'media', action: 'delete' }))

  const moderationIndexRoute = router
    .get(`${prefix}/admin/media`, [MediaModerationController, 'index'])
    .use(middleware.auth())
    .use(middleware.tenant({ required: true }))
    .use(middleware.permission({ resource: 'media', action: 'review' }))

  const approveRoute = router
    .post(`${prefix}/admin/media/:id/approve`, [MediaModerationController, 'approve'])
    .use(middleware.auth())
    .use(middleware.tenant({ required: true }))
    .use(middleware.permission({ resource: 'media', action: 'review' }))

  const rejectRoute = router
    .post(`${prefix}/admin/media/:id/reject`, [MediaModerationController, 'reject'])
    .use(middleware.auth())
    .use(middleware.tenant({ required: true }))
    .use(middleware.permission({ resource: 'media', action: 'review' }))

  const quarantineRoute = router
    .post(`${prefix}/admin/media/:id/quarantine`, [MediaModerationController, 'quarantine'])
    .use(middleware.auth())
    .use(middleware.tenant({ required: true }))
    .use(middleware.permission({ resource: 'media', action: 'review' }))

  const publicIndexRoute = router.get(`${prefix}/public/establishments/:id/media`, [
    PublicEstablishmentMediaController,
    'index',
  ])

  if (!named) {
    return
  }

  indexRoute.as('media.index')
  storeRoute.as('media.store')
  updateRoute.as('media.update')
  coverRoute.as('media.cover')
  orderRoute.as('media.order')
  destroyRoute.as('media.destroy')
  moderationIndexRoute.as('media.moderation.index')
  approveRoute.as('media.moderation.approve')
  rejectRoute.as('media.moderation.reject')
  quarantineRoute.as('media.moderation.quarantine')
  publicIndexRoute.as('media.public.index')
}

registerMediaRoutes('/api/v1', true)
registerMediaRoutes('', false)
