import { BaseCommand, args } from '@adonisjs/core/ace'

import PurchaseSimulationService from '#modules/purchases/services/purchase_simulation_service'

export default class SimulatePurchase extends BaseCommand {
  static commandName = 'purchases:simulate'
  static description =
    'Confirm a fake payment in development/homologation, then reconcile durable commands'
  static options = { startApp: true }
  @args.string() declare purchaseId: string
  async run() {
    // The same service backs "Confirmar pagamento simulado" in the back office: it refuses
    // production and any provider other than the fake one, then reconciles as the worker does.
    const service = await this.app.container.make(PurchaseSimulationService)
    this.logger.info(JSON.stringify(await service.confirm(this.purchaseId)))
  }
}
