import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { middleware } from '#start/kernel'

const PartnerPortalController = () =>
  import('#modules/portal/controllers/partner_portal_controller')
const BackofficePortalController = () =>
  import('#modules/portal/controllers/backoffice_portal_controller')

const permission = (resource: IPermission.Resources, action: IPermission.Actions) =>
  middleware.permission({ permissions: `${resource}.${action}` })

router
  .group(() => {
    router.get('/', [PartnerPortalController, 'index']).as('portal.index')

    router
      .get('/organizations/new', [PartnerPortalController, 'newOrganization'])
      .as('portal.organizations.new')
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.CREATE))
    router
      .post('/organizations', [PartnerPortalController, 'createOrganization'])
      .as('portal.organizations.create')
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.CREATE))
    router
      .get('/organizations/:organizationId', [PartnerPortalController, 'organization'])
      .as('portal.organizations.show')
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.READ))
    router
      .put('/organizations/:organizationId', [PartnerPortalController, 'updateOrganization'])
      .as('portal.organizations.update')
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.UPDATE))
    router
      .post('/organizations/:organizationId/submit', [
        PartnerPortalController,
        'submitOrganization',
      ])
      .as('portal.organizations.submit')
      .use(permission(IPermission.Resources.ORGANIZATIONS, IPermission.Actions.SUBMIT))

    router
      .get('/organizations/:organizationId/establishments/new', [
        PartnerPortalController,
        'newEstablishment',
      ])
      .as('portal.establishments.new')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.CREATE))
    router
      .post('/organizations/:organizationId/establishments', [
        PartnerPortalController,
        'createEstablishment',
      ])
      .as('portal.establishments.create')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.CREATE))

    router
      .get('/establishments/:establishmentId', [PartnerPortalController, 'establishment'])
      .as('portal.establishments.edit')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.READ))
    router
      .put('/establishments/:establishmentId/identity', [PartnerPortalController, 'updateIdentity'])
      .as('portal.establishments.identity')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.UPDATE))
    router
      .put('/establishments/:establishmentId/address', [PartnerPortalController, 'updateAddress'])
      .as('portal.establishments.address')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.UPDATE))
    router
      .put('/establishments/:establishmentId/categories', [
        PartnerPortalController,
        'updateCategories',
      ])
      .as('portal.establishments.categories')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.UPDATE))
    router
      .put('/establishments/:establishmentId/hours', [PartnerPortalController, 'updateHours'])
      .as('portal.establishments.hours')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.UPDATE))
    router
      .post('/establishments/:establishmentId/submit', [PartnerPortalController, 'submit'])
      .as('portal.establishments.submit')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.SUBMIT))
    router
      .post('/feedback', [PartnerPortalController, 'feedback'])
      .as('portal.feedback.create')
      .use(permission(IPermission.Resources.PILOT_FEEDBACK, IPermission.Actions.CREATE))
  })
  .prefix('/portal')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router
      .get('/moderation', [BackofficePortalController, 'moderation'])
      .as('backoffice.moderation.index')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.LIST))
    router
      .get('/moderation/:revisionId', [BackofficePortalController, 'revision'])
      .as('backoffice.moderation.show')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.READ))
    router
      .post('/moderation/:revisionId/approve', [BackofficePortalController, 'approveRevision'])
      .as('backoffice.moderation.approve')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.APPROVE))
    router
      .post('/moderation/:revisionId/request-changes', [
        BackofficePortalController,
        'requestChanges',
      ])
      .as('backoffice.moderation.request_changes')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.REQUEST_CHANGES))
    router
      .post('/moderation/:revisionId/reject', [BackofficePortalController, 'rejectRevision'])
      .as('backoffice.moderation.reject')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.REJECT))

    router
      .get('/feedback', [BackofficePortalController, 'feedback'])
      .as('backoffice.feedback.index')
      .use(permission(IPermission.Resources.PILOT_FEEDBACK, IPermission.Actions.LIST))
    router
      .patch('/feedback/:feedbackId', [BackofficePortalController, 'reviewFeedback'])
      .as('backoffice.feedback.update')
      .use(permission(IPermission.Resources.PILOT_FEEDBACK, IPermission.Actions.UPDATE))
  })
  .prefix('/backoffice')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))
