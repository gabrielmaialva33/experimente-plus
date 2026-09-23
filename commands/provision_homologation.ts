import { BaseCommand, flags } from '@adonisjs/core/ace'
import router from '@adonisjs/core/services/router'
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
  static help = [
    'Run inside the homologation container, with the private configuration used the first time:',
    '  node ace homologation:provision --config=/absolute/private/path.json',
    '',
    'The first run creates the operation, the accounts, two fictitious establishments and the editions.',
    'Every run, the first and each replay, then ensures demonstration content through the domain services: two experiences with a cover, two showcase items with an informational price, one event happening today and two in the coming days (dated by the city calendar), a review of each establishment by the provisioned customer with a partner reply, and one pending report so the moderation queue is not empty.',
    "Each item is created once and never restored: what a moderator archived stays archived. A run on a later day adds that day's events; past events leave the agenda on their own.",
    'Refused outside DEPLOYMENT_ENV=homologation, exactly like the baseline.',
  ]
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
      // Ace has no HTTP server to commit the routes. Drive fs uses named routes for public URLs.
      router.commit()
      const result = await service.run(config)
      // Only public IDs/counts: never echo configuration, emails, passwords or raw errors.
      this.logger.success(JSON.stringify(result))
      const demo = await service.provisionDemoContent(config)
      this.logger.success(
        `Demonstration content: ${demo.created.length} created, ${demo.alreadyPresent.length} already present`
      )
      for (const skipped of demo.notCreated)
        this.logger.warning(`Not created ${skipped.key}: ${skipped.reason}`)
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
