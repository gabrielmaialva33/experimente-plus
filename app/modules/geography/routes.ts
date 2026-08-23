import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

const RegionsController = () => import('#modules/geography/controllers/regions_controller')
const CitiesController = () => import('#modules/geography/controllers/cities_controller')
const PublicGeographyController = () =>
  import('#modules/geography/controllers/public_geography_controller')

router
  .group(() => {
    router.get('/regions', [RegionsController, 'index']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.REGIONS}.${IPermission.Actions.LIST}`,
      })
    )
    router.post('/regions', [RegionsController, 'store']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.REGIONS}.${IPermission.Actions.CREATE}`,
      })
    )
    router.get('/regions/:id', [RegionsController, 'show']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.REGIONS}.${IPermission.Actions.READ}`,
      })
    )
    router.put('/regions/:id', [RegionsController, 'update']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.REGIONS}.${IPermission.Actions.UPDATE}`,
      })
    )

    router.get('/cities', [CitiesController, 'index']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CITIES}.${IPermission.Actions.LIST}`,
      })
    )
    router.post('/cities', [CitiesController, 'store']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CITIES}.${IPermission.Actions.CREATE}`,
      })
    )
    router.get('/cities/:id', [CitiesController, 'show']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CITIES}.${IPermission.Actions.READ}`,
      })
    )
    router.put('/cities/:id', [CitiesController, 'update']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CITIES}.${IPermission.Actions.UPDATE}`,
      })
    )
  })
  .prefix('/api/v1/admin/geography')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router.get('/regions', [PublicGeographyController, 'regions'])
    router.get('/cities', [PublicGeographyController, 'cities'])
    router.get('/cities/:citySlug', [PublicGeographyController, 'city'])
  })
  .prefix('/api/v1/catalog')
  .use(throttle)
