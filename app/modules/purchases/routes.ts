import purchaseTransport from '#modules/purchases/middleware/purchase_transport'
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle, throttle } from '#start/limiter'
import { privateResponseHeadersMiddleware } from '#shared/utils/private_response_headers'

const PurchasesController = () => import('#modules/purchases/controllers/purchases_controller')
router.get('/api/v1/catalog/benefit-editions', [PurchasesController, 'catalog']).use(throttle)
router
  .post('/api/v1/payments/webhooks/:provider', [PurchasesController, 'webhook'])
  .use([privateResponseHeadersMiddleware, purchaseTransport, apiThrottle])
router
  .group(() => {
    router.get('/', [PurchasesController, 'index'])
    router.post('/', [PurchasesController, 'store'])
    router.get('/:id', [PurchasesController, 'show'])
    router.post('/:id/cancel', [PurchasesController, 'cancel'])
    router.post('/:id/refunds', [PurchasesController, 'refund'])
  })
  .prefix('/api/v1/me/purchases')
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    purchaseTransport,
    apiThrottle,
    middleware.tenant({ required: true }),
  ])
router
  .group(() => {
    router.get('/', [PurchasesController, 'operations'])
    router.get('/reconciliation', [PurchasesController, 'reconciliation'])
    router.post('/settlements', [PurchasesController, 'settlement'])
    router.get('/:id', [PurchasesController, 'detail'])
    router.post('/:id/reconcile', [PurchasesController, 'retry'])
    router.post('/:id/refunds/:refundId/decision', [PurchasesController, 'decide'])
  })
  .prefix('/api/v1/admin/purchases')
  .use([
    middleware.auth(),
    privateResponseHeadersMiddleware,
    purchaseTransport,
    apiThrottle,
    middleware.tenant({ required: true }),
  ])
