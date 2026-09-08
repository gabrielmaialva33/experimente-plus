import { BaseCommand, flags } from '@adonisjs/core/ace'
import { fileURLToPath } from 'node:url'
import HomologationProvisioningService from '#modules/tenants/services/homologation_provisioning_service'
import {
  readProvisioningConfig,
  ProvisioningError,
} from '#modules/tenants/services/homologation_provisioning_config'

export default class ProvisionHomologation extends BaseCommand {
  static commandName = 'homologation:provision'
  static description =
    'Provision isolated demonstration content and operator-supplied accounts in homologation'
  static options = { startApp: true }

  @flags.string({
    required: true,
    description: 'Absolute private JSON path outside the application; mode 0600',
  })
  declare config: string

  async run() {
    try {
      const service = await this.app.container.make(HomologationProvisioningService)
      service.assertEnvironment()
      const config = await readProvisioningConfig(this.config, fileURLToPath(this.app.appRoot))
      const result = await service.run(config)
      // Only public IDs/counts: never echo configuration, emails, passwords or raw errors.
      this.logger.success(JSON.stringify(result))
      this.logger.info(
        'Credentials supplied privately; none displayed or rotated. Preserve them in your password manager.'
      )
    } catch (error) {
      this.logger.error(
        error instanceof ProvisioningError
          ? error.message
          : 'Homologation provisioning failed; verify configuration and infrastructure privately'
      )
      this.exitCode = 1
    }
  }
}
