import { BaseCommand } from '@adonisjs/core/ace'
import PurchaseProcessingService from '#modules/purchases/services/purchase_processing_service'

export default class ProcessPurchases extends BaseCommand {
  static commandName = 'purchases:process'
  static description =
    'Reconcile payment notifications and execute up to 100 durable commands; schedule every minute'
  static options = { startApp: true }
  async run() {
    const service = await this.app.container.make(PurchaseProcessingService)
    this.logger.info(JSON.stringify(await service.reconcile()))
    const result = await service.drain()
    this.logger.info(JSON.stringify(result))
    if (result.deferred) this.exitCode = 1
  }
}
