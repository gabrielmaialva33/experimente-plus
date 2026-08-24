import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { middleware } from '#start/kernel'

const EstablishmentMediaController = () =>
  import('#modules/media/controllers/establishment_media_controller')
const MediaModerationController = () =>
  import('#modules/media/controllers/media_moderation_controller')
const PublicMediaController = () => import('#modules/media/controllers/public_media_controller')

const permission = (action: IPermission.Actions) =>
  middleware.permission({
    permissions: `${IPermission.Resources.MEDIA}.${action}`,
  })

router.get('/api/v1/public/establishments/:id/media', [PublicMediaController, 'index'])

router
  .group(() => {
    router
      .get('/establishments/:id/media', [EstablishmentMediaController, 'index'])
      .use(permission(IPermission.Actions.READ))
    router
      .post('/establishments/:id/media', [EstablishmentMediaController, 'store'])
      .use(permission(IPermission.Actions.CREATE))
    router
      .put('/establishments/:id/media/order', [EstablishmentMediaController, 'reorder'])
      .use(permission(IPermission.Actions.UPDATE))
    router
      .patch('/establishments/:id/media/:mediaId', [EstablishmentMediaController, 'update'])
      .use(permission(IPermission.Actions.UPDATE))
    router
      .patch('/establishments/:id/media/:mediaId/cover', [EstablishmentMediaController, 'cover'])
      .use(permission(IPermission.Actions.UPDATE))
    router
      .delete('/establishments/:id/media/:mediaId', [EstablishmentMediaController, 'destroy'])
      .use(permission(IPermission.Actions.DELETE))
  })
  .prefix('/api/v1')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router.get('/', [MediaModerationController, 'index']).use(permission(IPermission.Actions.LIST))
    router
      .post('/:id/approve', [MediaModerationController, 'approve'])
      .use(permission(IPermission.Actions.APPROVE))
    router
      .post('/:id/reject', [MediaModerationController, 'reject'])
      .use(permission(IPermission.Actions.REJECT))
    router
      .post('/:id/quarantine', [MediaModerationController, 'quarantine'])
      .use(permission(IPermission.Actions.REJECT))
  })
  .prefix('/api/v1/admin/media')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))
