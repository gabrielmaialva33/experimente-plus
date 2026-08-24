import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { middleware } from '#start/kernel'

const EstablishmentsController = () =>
  import('#modules/establishments/controllers/establishments_controller')
const EstablishmentSectionsController = () =>
  import('#modules/establishments/controllers/establishment_sections_controller')

const permission = (action: IPermission.Actions) =>
  middleware.permission({
    permissions: `${IPermission.Resources.ESTABLISHMENTS}.${action}`,
  })

router
  .group(() => {
    router
      .get('/organizations/:organizationId/establishments', [EstablishmentsController, 'index'])
      .use(permission(IPermission.Actions.LIST))
    router
      .post('/organizations/:organizationId/establishments', [EstablishmentsController, 'store'])
      .use(permission(IPermission.Actions.CREATE))

    router
      .get('/establishments/:id', [EstablishmentsController, 'show'])
      .use(permission(IPermission.Actions.READ))
    router
      .put('/establishments/:id/revision', [EstablishmentsController, 'updateRevision'])
      .use(permission(IPermission.Actions.UPDATE))
    router
      .put('/establishments/:id/address', [EstablishmentSectionsController, 'address'])
      .use(permission(IPermission.Actions.UPDATE))
    router
      .put('/establishments/:id/categories', [EstablishmentSectionsController, 'categories'])
      .use(permission(IPermission.Actions.UPDATE))
    router
      .put('/establishments/:id/attributes', [EstablishmentSectionsController, 'attributes'])
      .use(permission(IPermission.Actions.UPDATE))
    router
      .put('/establishments/:id/hours', [EstablishmentSectionsController, 'hours'])
      .use(permission(IPermission.Actions.UPDATE))
    router
      .put('/establishments/:id/special-days', [EstablishmentSectionsController, 'specialDays'])
      .use(permission(IPermission.Actions.UPDATE))
    router
      .patch('/establishments/:id/business-status', [
        EstablishmentsController,
        'updateBusinessStatus',
      ])
      .use(permission(IPermission.Actions.UPDATE))
    router
      .get('/establishments/:id/completeness', [EstablishmentsController, 'completeness'])
      .use(permission(IPermission.Actions.READ))
    router
      .delete('/establishments/:id', [EstablishmentsController, 'destroy'])
      .use(permission(IPermission.Actions.ARCHIVE))

    router
      .get('/taxonomy/categories/:categoryId/effective-attributes', [
        EstablishmentSectionsController,
        'effectiveAttributes',
      ])
      .use(permission(IPermission.Actions.READ))
  })
  .prefix('/api/v1')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))
