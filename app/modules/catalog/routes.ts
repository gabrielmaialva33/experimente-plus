import router from '@adonisjs/core/services/router'

import { throttle } from '#start/limiter'

const CatalogController = () => import('#modules/catalog/controllers/catalog_controller')

router
  .group(() => {
    router.get('/cities', [CatalogController, 'cities']).as('catalog.cities')
    router
      .get('/cities/:citySlug/categories', [CatalogController, 'categories'])
      .as('catalog.city.categories')
    router
      .get('/cities/:citySlug/filters', [CatalogController, 'filters'])
      .as('catalog.city.filters')
    router
      .get('/cities/:citySlug/establishments', [CatalogController, 'index'])
      .as('catalog.city.establishments')
    router
      .get('/cities/:citySlug/establishments/:establishmentSlug', [CatalogController, 'show'])
      .as('catalog.establishment.show')
  })
  .prefix('/api/v1/catalog')
  .use(throttle)

const CatalogPagesController = () => import('#modules/catalog/controllers/catalog_pages_controller')

router.get('/cidades', [CatalogPagesController, 'cities']).as('catalog.pages.cities')
router.get('/cidades/:citySlug', [CatalogPagesController, 'index']).as('catalog.pages.city')
router
  .get('/cidades/:citySlug/categorias', [CatalogPagesController, 'categories'])
  .as('catalog.pages.categories')
router
  .get('/cidades/:citySlug/categorias/:categorySlug', [CatalogPagesController, 'indexByCategory'])
  .as('catalog.pages.category')
router
  .get('/cidades/:citySlug/estabelecimentos/:establishmentSlug', [CatalogPagesController, 'show'])
  .as('catalog.pages.establishment')
