import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { analyticsEventsThrottle, analyticsRedirectThrottle } from '#start/limiter'
import { middleware } from '#start/kernel'

const AnalyticsEventsController = () =>
  import('#modules/analytics/controllers/analytics_events_controller')
const AnalyticsRedirectController = () =>
  import('#modules/analytics/controllers/analytics_redirect_controller')
const OrganizationAnalyticsController = () =>
  import('#modules/analytics/controllers/organization_analytics_controller')
const AdminAnalyticsController = () =>
  import('#modules/analytics/controllers/admin_analytics_controller')

router
  .post('/api/v1/analytics/events', [AnalyticsEventsController, 'store'])
  .use(analyticsEventsThrottle)

router
  .get('/go/:citySlug/:establishmentSlug/:action', [AnalyticsRedirectController, 'redirect'])
  .use(analyticsRedirectThrottle)

router
  .get('/api/v1/organizations/:organizationId/analytics', [OrganizationAnalyticsController, 'show'])
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))
  .use(
    middleware.permission({
      permissions: `${IPermission.Resources.ANALYTICS}.${IPermission.Actions.READ}`,
    })
  )

router
  .get('/api/v1/admin/analytics/searches/no-results', [
    AdminAnalyticsController,
    'noResultSearches',
  ])
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))
  .use(
    middleware.permission({
      permissions: `${IPermission.Resources.ANALYTICS}.${IPermission.Actions.LIST}`,
    })
  )
