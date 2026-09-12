import { BaseCommand, flags } from '@adonisjs/core/ace'
import { fileURLToPath } from 'node:url'
import HomologationProvisioningService from '#modules/tenants/services/homologation_provisioning_service'
import {
  readProvisioningConfig,
  ProvisioningError,
} from '#modules/tenants/services/homologation_provisioning_config'

export default class ProvisionTestAccounts extends BaseCommand {
  static commandName = 'homologation:provision-test-accounts'
  static description =
    'Explicitly add root, partner and customer TEST identities to an existing demonstration baseline'
  static options = { startApp: true }

  @flags.string({
    required: true,
    description: 'Absolute private JSON path outside the application; mode 0600',
  })
  declare config: string

  @flags.boolean({
    description:
      'Deliberately allow test emails and legacy passwords; creates a global root. Never production.',
  })
  declare allowTestAccounts: boolean

  async run() {
    try {
      const service = await this.app.container.make(HomologationProvisioningService)
      service.assertTestAccountsEnvironment(this.allowTestAccounts)
      const config = await readProvisioningConfig(
        this.config,
        fileURLToPath(this.app.appRoot),
        true
      )
      const receipt = await service.provisionTestAccounts(config, this.allowTestAccounts)
      this.logger.warning(
        'TEST ACCOUNTS: global root, organization partner and courtesy customer. Never promote this dataset to production.'
      )
      this.logger.success(JSON.stringify(receipt))
      this.logger.info('Private credentials are neither displayed nor rotated on replay.')
    } catch (error) {
      this.logger.error(
        error instanceof ProvisioningError
          ? error.message
          : 'Test account provisioning failed; verify configuration privately'
      )
      this.exitCode = 1
    }
  }
}
