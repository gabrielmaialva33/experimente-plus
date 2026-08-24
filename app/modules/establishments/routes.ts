import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { middleware } from '#start/kernel'

const EstablishmentsController = () =>
  import('#modules/establishments/controllers/establishments_controller')
const EstablishmentSectionsController = () =>
  import('#modules/establishments/controllers/establishment_sections_controller')
const EstablishmentSubmissionController = () =>
  import('#modules/establishments/controllers/establishment_submission_controller')
const AdminEstablishmentRevisionsController = () =>
  import('#modules/establishments/controllers/admin_establishment_revisions_controller')
const AdminEstablishmentsController = () =>
  import('#modules/establishments/controllers/admin_establishments_controller')

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
      .get('/establishments/:id/review', [EstablishmentSubmissionController, 'show'])
      .use(permission(IPermission.Actions.READ))
    router
      .post('/establishments/:id/revisions', [EstablishmentSubmissionController, 'createRevision'])
      .use(permission(IPermission.Actions.CREATE))
    router
      .post('/establishments/:id/submit', [EstablishmentSubmissionController, 'submit'])
      .use(permission(IPermission.Actions.SUBMIT))

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

router
  .group(() => {
    router
      .get('/establishment-revisions', [AdminEstablishmentRevisionsController, 'index'])
      .use(permission(IPermission.Actions.LIST))
    router
      .get('/establishment-revisions/:id', [AdminEstablishmentRevisionsController, 'show'])
      .use(permission(IPermission.Actions.READ))
    router
      .post('/establishment-revisions/:id/approve', [
        AdminEstablishmentRevisionsController,
        'approve',
      ])
      .use(permission(IPermission.Actions.APPROVE))
    router
      .post('/establishment-revisions/:id/request-changes', [
        AdminEstablishmentRevisionsController,
        'requestChanges',
      ])
      .use(permission(IPermission.Actions.REQUEST_CHANGES))
    router
      .post('/establishment-revisions/:id/reject', [
        AdminEstablishmentRevisionsController,
        'reject',
      ])
      .use(permission(IPermission.Actions.REJECT))
    router
      .post('/establishments/:id/suspend', [AdminEstablishmentsController, 'suspend'])
      .use(permission(IPermission.Actions.SUSPEND))
    router
      .post('/establishments/:id/restore', [AdminEstablishmentsController, 'restore'])
      .use(permission(IPermission.Actions.RESTORE))
  })
  .prefix('/api/v1/admin')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))
