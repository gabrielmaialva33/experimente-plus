import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle, throttle } from '#start/limiter'
import { privateResponseHeadersMiddleware } from '#shared/utils/private_response_headers'

const ReviewsController = () => import('#modules/reviews/controllers/reviews_controller')
const ReviewPhotosController = () => import('#modules/reviews/controllers/review_photos_controller')
const UserBansController = () => import('#modules/reviews/controllers/user_bans_controller')

router
  .get('/api/v1/catalog/establishments/:establishmentId/reviews', [
    ReviewsController,
    'catalogReviews',
  ])
  .use(throttle)

router.get('/api/v1/catalog/reviews/:id', [ReviewsController, 'showPublic']).use(throttle)

router
  .group(() => {
    router.get('/', [ReviewsController, 'myReviews'])
    router.post('/', [ReviewsController, 'store'])
    router.put('/:id', [ReviewsController, 'update'])
    router.delete('/:id', [ReviewsController, 'destroy'])
    router
      .post('/:id/photos', [ReviewPhotosController, 'store'])
      .where('id', router.matchers.number())
    router
      .delete('/:id/photos/:photoId', [ReviewPhotosController, 'destroy'])
      .where('id', router.matchers.number())
      .where('photoId', router.matchers.number())
  })
  .prefix('/api/v1/me/reviews')
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    apiThrottle,
    middleware.tenant({ required: true }),
  ])

router
  .group(() => {
    router.post('/:reviewId/replies', [ReviewsController, 'reply'])
    router.put('/:reviewId/replies', [ReviewsController, 'updateReply'])
  })
  .prefix('/api/v1/portal/reviews')
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    apiThrottle,
    middleware.tenant({ required: true }),
  ])

router
  .post('/api/v1/content-reports', [ReviewsController, 'report'])
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    apiThrottle,
    middleware.tenant({ required: true }),
  ])

router
  .group(() => {
    router.get('/content-reports', [ReviewsController, 'listReports'])
    router.post('/content-reports/:id/resolve', [ReviewsController, 'resolveReport'])
    router.get('/review-policy', [ReviewsController, 'getPolicy'])
    router.put('/review-policy', [ReviewsController, 'updatePolicy'])
    router
      .get('/users/:userId/ban', [UserBansController, 'show'])
      .where('userId', router.matchers.number())
    router
      .post('/users/:userId/ban', [UserBansController, 'ban'])
      .where('userId', router.matchers.number())
    router
      .post('/users/:userId/unban', [UserBansController, 'unban'])
      .where('userId', router.matchers.number())
  })
  .prefix('/api/v1/admin')
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    apiThrottle,
    middleware.tenant({ required: true }),
  ])
