import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { middleware } from '#start/kernel'

const PartnerPortalController = () =>
  import('#modules/portal/controllers/partner_portal_controller')
const BackofficePortalController = () =>
  import('#modules/portal/controllers/backoffice_portal_controller')
const PartnerContentPagesController = () =>
  import('#modules/partner_content/controllers/partner_content_pages_controller')
const ContentReportPagesController = () =>
  import('#modules/reviews/controllers/content_report_pages_controller')
const ReviewPolicyPagesController = () =>
  import('#modules/reviews/controllers/review_policy_pages_controller')
const TaxonomyPagesController = () =>
  import('#modules/taxonomy/controllers/taxonomy_pages_controller')
const GeographyPagesController = () =>
  import('#modules/geography/controllers/geography_pages_controller')

const permission = (resource: IPermission.Resources, action: IPermission.Actions) =>
  middleware.permission({ permissions: `${resource}.${action}` })

/** A page that shows two resources needs the right to read both. */
const permissions = (...pairs: [IPermission.Resources, IPermission.Actions][]) =>
  middleware.permission({
    permissions: pairs.map(([resource, action]) => `${resource}.${action}`),
    requireAll: true,
  })

router
  .group(() => {
    router.get('/', [PartnerPortalController, 'index']).as('portal.index')

    router
      .get('/content', [PartnerContentPagesController, 'portal'])
      .as('portal.content.index')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.READ))
    router
      .post('/content/:kind', [PartnerContentPagesController, 'create'])
      .as('portal.content.create')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.UPDATE))
    router
      .put('/content/:kind/:id', [PartnerContentPagesController, 'update'])
      .as('portal.content.update')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.UPDATE))
    router
      .post('/content/:kind/:id/submit', [PartnerContentPagesController, 'submit'])
      .as('portal.content.submit')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.SUBMIT))
    router
      .post('/content/:kind/:id/archive', [PartnerContentPagesController, 'archive'])
      .as('portal.content.archive')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.ARCHIVE))

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
      .put('/establishments/:establishmentId/attributes', [
        PartnerPortalController,
        'updateAttributes',
      ])
      .as('portal.establishments.attributes')
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
      .post('/establishments/:establishmentId/revisions', [
        PartnerPortalController,
        'createRevision',
      ])
      .as('portal.establishments.revisions.create')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.CREATE))
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
      .get('/content', [PartnerContentPagesController, 'moderation'])
      .as('backoffice.content.index')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.LIST))
    router
      .post('/content/:kind/:id/approve', [PartnerContentPagesController, 'approve'])
      .as('backoffice.content.approve')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.APPROVE))
    router
      .post('/content/:kind/:id/reject', [PartnerContentPagesController, 'reject'])
      .as('backoffice.content.reject')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.REJECT))
    router
      .post('/content/:kind/:id/archive', [PartnerContentPagesController, 'moderationArchive'])
      .as('backoffice.content.archive')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.ARCHIVE))
    router
      .put('/content/:kind/:id', [PartnerContentPagesController, 'moderationUpdate'])
      .where('kind', /^(experiences|events|showcase-items)$/)
      .as('backoffice.content.update')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.UPDATE))
    router
      .put('/content/policy', [PartnerContentPagesController, 'updatePolicy'])
      .as('backoffice.content.policy')
      .use(permission(IPermission.Resources.SETTINGS, IPermission.Actions.UPDATE))

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

    /**
     * Content reports — ADR-0027.
     *
     * They are guarded by the establishment permissions the neighbouring
     * queues use, because that is what the platform moderators who work this
     * screen already hold, and because inventing a `content_reports` resource
     * would mean seeding it and back-filling every role for one screen. The
     * service still requires a platform moderator of its own accord, so the
     * permission narrows who reaches the page rather than deciding it.
     */
    router
      .get('/reports', [ContentReportPagesController, 'index'])
      .as('backoffice.reports.index')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.LIST))
    router
      .post('/reports/:id/resolve', [ContentReportPagesController, 'resolve'])
      .as('backoffice.reports.resolve')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.UPDATE))
    router
      .post('/users/:userId/ban', [ContentReportPagesController, 'banAuthor'])
      .as('backoffice.users.ban')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.UPDATE))
    router
      .post('/users/:userId/unban', [ContentReportPagesController, 'unbanAuthor'])
      .as('backoffice.users.unban')
      .use(permission(IPermission.Resources.ESTABLISHMENTS, IPermission.Actions.UPDATE))

    /**
     * Administration screens over APIs that already existed — Anexo I item 12.
     *
     * Each route carries the permission of the resource it writes, the same one
     * its `/api/v1/admin` counterpart carries, so the page is never a wider door
     * than the API it sits on. The review policy additionally requires a
     * platform administrator inside its service, as the API does.
     */
    router
      .get('/review-policy', [ReviewPolicyPagesController, 'show'])
      .as('backoffice.review_policy.show')
      .use(permission(IPermission.Resources.SETTINGS, IPermission.Actions.READ))
    router
      .put('/review-policy', [ReviewPolicyPagesController, 'update'])
      .as('backoffice.review_policy.update')
      .use(permission(IPermission.Resources.SETTINGS, IPermission.Actions.UPDATE))

    router
      .get('/taxonomy', [TaxonomyPagesController, 'index'])
      .as('backoffice.taxonomy.index')
      .use(
        permissions(
          [IPermission.Resources.CATEGORY_FAMILIES, IPermission.Actions.LIST],
          [IPermission.Resources.CATEGORIES, IPermission.Actions.LIST]
        )
      )
    router
      .post('/taxonomy/families', [TaxonomyPagesController, 'storeFamily'])
      .as('backoffice.taxonomy.families.store')
      .use(permission(IPermission.Resources.CATEGORY_FAMILIES, IPermission.Actions.CREATE))
    router
      .put('/taxonomy/families/:id', [TaxonomyPagesController, 'updateFamily'])
      .as('backoffice.taxonomy.families.update')
      .where('id', router.matchers.number())
      .use(permission(IPermission.Resources.CATEGORY_FAMILIES, IPermission.Actions.UPDATE))
    router
      .post('/taxonomy/categories', [TaxonomyPagesController, 'storeCategory'])
      .as('backoffice.taxonomy.categories.store')
      .use(permission(IPermission.Resources.CATEGORIES, IPermission.Actions.CREATE))
    router
      .put('/taxonomy/categories/:id', [TaxonomyPagesController, 'updateCategory'])
      .as('backoffice.taxonomy.categories.update')
      .where('id', router.matchers.number())
      .use(permission(IPermission.Resources.CATEGORIES, IPermission.Actions.UPDATE))

    router
      .get('/geography', [GeographyPagesController, 'index'])
      .as('backoffice.geography.index')
      .use(
        permissions(
          [IPermission.Resources.REGIONS, IPermission.Actions.LIST],
          [IPermission.Resources.CITIES, IPermission.Actions.LIST]
        )
      )
    router
      .post('/geography/regions', [GeographyPagesController, 'storeRegion'])
      .as('backoffice.geography.regions.store')
      .use(permission(IPermission.Resources.REGIONS, IPermission.Actions.CREATE))
    router
      .put('/geography/regions/:id', [GeographyPagesController, 'updateRegion'])
      .as('backoffice.geography.regions.update')
      .where('id', router.matchers.number())
      .use(permission(IPermission.Resources.REGIONS, IPermission.Actions.UPDATE))
    router
      .post('/geography/cities', [GeographyPagesController, 'storeCity'])
      .as('backoffice.geography.cities.store')
      .use(permission(IPermission.Resources.CITIES, IPermission.Actions.CREATE))
    router
      .put('/geography/cities/:id', [GeographyPagesController, 'updateCity'])
      .as('backoffice.geography.cities.update')
      .where('id', router.matchers.number())
      .use(permission(IPermission.Resources.CITIES, IPermission.Actions.UPDATE))
  })
  .prefix('/backoffice')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))
