import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle } from '#start/limiter'
import { privateResponseHeadersMiddleware } from '#shared/utils/private_response_headers'

const ExplorerController = () => import('#modules/explorer/controllers/explorer_controller')

/**
 * The Explorer's own layer — ADR-0030, Anexo I item 10.
 *
 * Everything lives under `/api/v1/me` because everything belongs to whoever is
 * calling. There is no public route here and no route that answers about a
 * different person: which establishments someone favourites or follows is a
 * private preference, and nothing in the scope asks for it to be observable.
 *
 * Saving is `PUT` because it is idempotent — saving twice is the same intent —
 * and a client retrying after a dropped response must not create a second row
 * or get an error for something that already worked.
 */
router
  .group(() => {
    router.get('/favorites', [ExplorerController, 'listFavorites'])
    router
      .put('/favorites/:establishmentId', [ExplorerController, 'favorite'])
      .where('establishmentId', router.matchers.number())
    router
      .delete('/favorites/:establishmentId', [ExplorerController, 'unfavorite'])
      .where('establishmentId', router.matchers.number())

    // Experiences and events. Showcase items are not a kind here: favouriting a
    // priced product is a wishlist, which the contract keeps out (Anexo I 16).
    router.get('/favorites/content', [ExplorerController, 'listContentFavorites'])
    router
      .put('/favorites/content/:kind/:contentId', [ExplorerController, 'favoriteContent'])
      .where('kind', /^(experiences|events)$/)
      .where('contentId', router.matchers.number())
    router
      .delete('/favorites/content/:kind/:contentId', [ExplorerController, 'unfavoriteContent'])
      .where('kind', /^(experiences|events)$/)
      .where('contentId', router.matchers.number())

    router.get('/follows', [ExplorerController, 'listFollows'])
    router
      .put('/follows/:establishmentId', [ExplorerController, 'follow'])
      .where('establishmentId', router.matchers.number())
    router
      .delete('/follows/:establishmentId', [ExplorerController, 'unfollow'])
      .where('establishmentId', router.matchers.number())

    router
      .get('/saved/:establishmentId', [ExplorerController, 'savedStatus'])
      .where('establishmentId', router.matchers.number())

    router.get('/interests', [ExplorerController, 'listInterests'])
    router.put('/interests', [ExplorerController, 'replaceInterests'])

    router.get('/itineraries', [ExplorerController, 'listItineraries'])
    router.post('/itineraries', [ExplorerController, 'createItinerary'])
    router
      .get('/itineraries/:id', [ExplorerController, 'showItinerary'])
      .where('id', router.matchers.number())
    router
      .put('/itineraries/:id', [ExplorerController, 'updateItinerary'])
      .where('id', router.matchers.number())
    router
      .delete('/itineraries/:id', [ExplorerController, 'destroyItinerary'])
      .where('id', router.matchers.number())
    router
      .post('/itineraries/:id/stops', [ExplorerController, 'addStop'])
      .where('id', router.matchers.number())
    router
      .put('/itineraries/:id/stops/order', [ExplorerController, 'reorderStops'])
      .where('id', router.matchers.number())
    router
      .delete('/itineraries/:id/stops/:stopId', [ExplorerController, 'removeStop'])
      .where('id', router.matchers.number())
      .where('stopId', router.matchers.number())
  })
  .prefix('/api/v1/me')
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    apiThrottle,
    middleware.tenant({ required: true }),
  ])
