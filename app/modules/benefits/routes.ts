import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { middleware } from '#start/kernel'

const BenefitEditionsController = () =>
  import('#modules/benefits/controllers/benefit_editions_controller')
const BenefitOffersController = () =>
  import('#modules/benefits/controllers/benefit_offers_controller')
const BenefitAccessesController = () =>
  import('#modules/benefits/controllers/benefit_accesses_controller')
const BenefitWalletController = () =>
  import('#modules/benefits/controllers/benefit_wallet_controller')
const BenefitPagesController = () =>
  import('#modules/benefits/controllers/benefit_pages_controller')
const BenefitAccessPagesController = () =>
  import('#modules/benefits/controllers/benefit_access_pages_controller')

const permission = (resource: IPermission.Resources, action: IPermission.Actions) =>
  middleware.permission({ permissions: `${resource}.${action}` })

router
  .get('/api/v1/benefit-editions', [BenefitEditionsController, 'available'])
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))
  .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.LIST))

router
  .group(() => {
    router
      .get('/', [BenefitEditionsController, 'index'])
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.LIST))
    router
      .post('/', [BenefitEditionsController, 'store'])
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.CREATE))
    router
      .get('/:id', [BenefitEditionsController, 'show'])
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.READ))
    router
      .put('/:id', [BenefitEditionsController, 'update'])
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.UPDATE))
    router
      .post('/:id/publish', [BenefitEditionsController, 'publish'])
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.UPDATE))
    router
      .post('/:id/pause', [BenefitEditionsController, 'pause'])
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.UPDATE))
    router
      .delete('/:id', [BenefitEditionsController, 'destroy'])
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.ARCHIVE))
  })
  .prefix('/api/v1/admin/benefit-editions')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router
      .get('/', [BenefitAccessesController, 'index'])
      .use(permission(IPermission.Resources.BENEFIT_ACCESSES, IPermission.Actions.LIST))
    router
      .post('/', [BenefitAccessesController, 'store'])
      .use(permission(IPermission.Resources.BENEFIT_ACCESSES, IPermission.Actions.CREATE))
    router
      .post('/:id/revoke', [BenefitAccessesController, 'revoke'])
      .use(permission(IPermission.Resources.BENEFIT_ACCESSES, IPermission.Actions.REVOKE))
  })
  .prefix('/api/v1/admin/benefit-accesses')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router
  .get('/api/v1/me/wallet', [BenefitWalletController, 'show'])
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router
      .get('/establishments/:establishmentId/benefit-offers', [BenefitOffersController, 'index'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.LIST))
    router
      .post('/establishments/:establishmentId/benefit-offers', [BenefitOffersController, 'store'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.CREATE))
    router
      .get('/benefit-offers/:id', [BenefitOffersController, 'show'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.READ))
    router
      .put('/benefit-offers/:id', [BenefitOffersController, 'update'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.UPDATE))
    router
      .post('/benefit-offers/:id/activate', [BenefitOffersController, 'activate'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.UPDATE))
    router
      .post('/benefit-offers/:id/pause', [BenefitOffersController, 'pause'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.UPDATE))
    router
      .delete('/benefit-offers/:id', [BenefitOffersController, 'destroy'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.ARCHIVE))
  })
  .prefix('/api/v1')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router
      .get('/', [BenefitPagesController, 'backoffice'])
      .as('backoffice.benefits.index')
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.CREATE))
    router
      .post('/', [BenefitPagesController, 'createEdition'])
      .as('backoffice.benefits.create')
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.CREATE))
    router
      .put('/:editionId', [BenefitPagesController, 'updateEdition'])
      .as('backoffice.benefits.update')
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.UPDATE))
    router
      .post('/:editionId/publish', [BenefitPagesController, 'publishEdition'])
      .as('backoffice.benefits.publish')
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.UPDATE))
    router
      .post('/:editionId/pause', [BenefitPagesController, 'pauseEdition'])
      .as('backoffice.benefits.pause')
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.UPDATE))
    router
      .delete('/:editionId', [BenefitPagesController, 'archiveEdition'])
      .as('backoffice.benefits.archive')
      .use(permission(IPermission.Resources.BENEFIT_EDITIONS, IPermission.Actions.ARCHIVE))
  })
  .prefix('/backoffice/benefits')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router
      .get('/', [BenefitAccessPagesController, 'index'])
      .as('backoffice.accesses.index')
      .use(permission(IPermission.Resources.BENEFIT_ACCESSES, IPermission.Actions.LIST))
    router
      .post('/', [BenefitAccessPagesController, 'store'])
      .as('backoffice.accesses.store')
      .use(permission(IPermission.Resources.BENEFIT_ACCESSES, IPermission.Actions.CREATE))
    router
      .post('/:accessId/revoke', [BenefitAccessPagesController, 'revoke'])
      .as('backoffice.accesses.revoke')
      .use(permission(IPermission.Resources.BENEFIT_ACCESSES, IPermission.Actions.REVOKE))
  })
  .prefix('/backoffice/accesses')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router
      .get('/establishments/:establishmentId/benefits', [BenefitPagesController, 'establishment'])
      .as('portal.establishments.benefits')
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.LIST))
    router
      .post('/establishments/:establishmentId/benefits', [BenefitPagesController, 'createOffer'])
      .as('portal.establishments.benefits.create')
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.CREATE))
    router
      .put('/benefit-offers/:offerId', [BenefitPagesController, 'updateOffer'])
      .as('portal.benefit_offers.update')
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.UPDATE))
    router
      .post('/benefit-offers/:offerId/activate', [BenefitPagesController, 'activateOffer'])
      .as('portal.benefit_offers.activate')
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.UPDATE))
    router
      .post('/benefit-offers/:offerId/pause', [BenefitPagesController, 'pauseOffer'])
      .as('portal.benefit_offers.pause')
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.UPDATE))
    router
      .delete('/benefit-offers/:offerId', [BenefitPagesController, 'archiveOffer'])
      .as('portal.benefit_offers.archive')
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.ARCHIVE))
  })
  .prefix('/portal')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))

router
  .get('/wallet', [BenefitWalletController, 'page'])
  .as('wallet.index')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))

router
  .get('/carteira', ({ response }) => response.redirect().toPath('/wallet'))
  .use(middleware.auth({ guards: ['jwt'] }))

// EP-11 — presentation and transactional redemption
const BenefitRedemptionsController = () =>
  import('#modules/benefits/controllers/benefit_redemptions_controller')
const BenefitRedemptionPagesController = () =>
  import('#modules/benefits/controllers/benefit_redemption_pages_controller')

router
  .group(() => {
    router.post('/presentations', [BenefitRedemptionsController, 'present'])
    router.get('/redemptions', [BenefitRedemptionsController, 'myHistory'])
    router.get('/redemptions/:receiptCode', [BenefitRedemptionsController, 'myReceipt'])
  })
  .prefix('/api/v1/me/benefits')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router
      .post('/preview', [BenefitRedemptionsController, 'preview'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.UPDATE))
    router
      .post('/', [BenefitRedemptionsController, 'store'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.UPDATE))
    router
      .get('/', [BenefitRedemptionsController, 'partnerHistory'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.READ))
  })
  .prefix('/api/v1/benefit-redemptions')
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router.get('/accesses/:accessId/offers/:offerId/use', [
      BenefitRedemptionPagesController,
      'present',
    ])
    router.get('/history', [BenefitRedemptionPagesController, 'walletHistory'])
    router.get('/redemptions/:receiptCode', [BenefitRedemptionPagesController, 'walletReceipt'])
  })
  .prefix('/wallet')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))

router
  .group(() => {
    router
      .get('/redemptions/validate', [BenefitRedemptionPagesController, 'validate'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.UPDATE))
    router
      .post('/redemptions', [BenefitRedemptionPagesController, 'redeem'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.UPDATE))
    router
      .get('/redemptions', [BenefitRedemptionPagesController, 'partnerHistory'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.READ))
    router
      .get('/redemptions/:receiptCode', [BenefitRedemptionPagesController, 'partnerReceipt'])
      .use(permission(IPermission.Resources.BENEFIT_OFFERS, IPermission.Actions.READ))
  })
  .prefix('/portal')
  .use(middleware.auth({ guards: ['jwt'] }))
  .use(middleware.tenant({ required: true }))
