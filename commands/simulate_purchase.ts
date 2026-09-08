import { deploymentEnvironment } from '#shared/utils/deployment_environment'
import { BaseCommand, args } from '@adonisjs/core/ace'
import env from '#start/env'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'
import FakePaymentAdapter from '#modules/purchases/adapters/fake_payment_adapter'
import PurchaseProcessingService from '#modules/purchases/services/purchase_processing_service'

export default class SimulatePurchase extends BaseCommand {
  static commandName = 'purchases:simulate'
  static description =
    'Confirm a fake payment in development/homologation, then reconcile durable commands'
  static options = { startApp: true }
  @args.string() declare purchaseId: string
  async run() {
    if (deploymentEnvironment(env.get('DEPLOYMENT_ENV')) === 'production')
      throw new Error('Simulation is forbidden in production')
    const resolved1 = await this.app.container.make(PaymentProviderService)
    const port = resolved1.get()
    if (!(port instanceof FakePaymentAdapter)) throw new Error('Select PAYMENT_PROVIDER=fake')
    const service = await this.app.container.make(PurchaseProcessingService)
    await service.drain()
    await port.simulate('fake_' + this.purchaseId, {
      state: 'paid',
      paidAt: new Date().toISOString(),
    })
    await service.reconcile()
    this.logger.info(JSON.stringify(await service.drain()))
  }
}
