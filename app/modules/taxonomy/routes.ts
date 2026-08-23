import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

const CategoryFamiliesController = () =>
  import('#modules/taxonomy/controllers/category_families_controller')
const CategoriesController = () => import('#modules/taxonomy/controllers/categories_controller')
const AttributeDefinitionsController = () =>
  import('#modules/taxonomy/controllers/category_attribute_definitions_controller')
const AttributeOptionsController = () =>
  import('#modules/taxonomy/controllers/category_attribute_options_controller')
const PublicTaxonomyController = () =>
  import('#modules/taxonomy/controllers/public_taxonomy_controller')

router
  .group(() => {
    router.get('/families', [CategoryFamiliesController, 'index']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_FAMILIES}.${IPermission.Actions.LIST}`,
      })
    )
    router.post('/families', [CategoryFamiliesController, 'store']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_FAMILIES}.${IPermission.Actions.CREATE}`,
      })
    )
    router.get('/families/:id', [CategoryFamiliesController, 'show']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_FAMILIES}.${IPermission.Actions.READ}`,
      })
    )
    router.put('/families/:id', [CategoryFamiliesController, 'update']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_FAMILIES}.${IPermission.Actions.UPDATE}`,
      })
    )

    router.get('/categories', [CategoriesController, 'index']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORIES}.${IPermission.Actions.LIST}`,
      })
    )
    router.post('/categories', [CategoriesController, 'store']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORIES}.${IPermission.Actions.CREATE}`,
      })
    )
    router.get('/categories/:id', [CategoriesController, 'show']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORIES}.${IPermission.Actions.READ}`,
      })
    )
    router.put('/categories/:id', [CategoriesController, 'update']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORIES}.${IPermission.Actions.UPDATE}`,
      })
    )

    router.get('/attributes', [AttributeDefinitionsController, 'index']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_ATTRIBUTES}.${IPermission.Actions.LIST}`,
      })
    )
    router.post('/attributes', [AttributeDefinitionsController, 'store']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_ATTRIBUTES}.${IPermission.Actions.CREATE}`,
      })
    )
    router.get('/attributes/:id', [AttributeDefinitionsController, 'show']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_ATTRIBUTES}.${IPermission.Actions.READ}`,
      })
    )
    router.put('/attributes/:id', [AttributeDefinitionsController, 'update']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_ATTRIBUTES}.${IPermission.Actions.UPDATE}`,
      })
    )

    router.get('/attribute-options', [AttributeOptionsController, 'index']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_ATTRIBUTES}.${IPermission.Actions.LIST}`,
      })
    )
    router.post('/attribute-options', [AttributeOptionsController, 'store']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_ATTRIBUTES}.${IPermission.Actions.CREATE}`,
      })
    )
    router.put('/attribute-options/:id', [AttributeOptionsController, 'update']).use(
      middleware.permission({
        permissions: `${IPermission.Resources.CATEGORY_ATTRIBUTES}.${IPermission.Actions.UPDATE}`,
      })
    )
  })
  .prefix('/api/v1/admin/taxonomy')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router.get('/api/v1/catalog/categories', [PublicTaxonomyController, 'tree']).use(throttle)
