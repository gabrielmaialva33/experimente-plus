import { fileURLToPath } from 'node:url'

import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import BootstrapCredentialRotationService, {
  type BootstrapCredentialRotationResult,
} from '#modules/auth/services/bootstrap_credential_rotation_service'
import {
  BOOTSTRAP_CREDENTIAL_HOST_DIRECTORY,
  BOOTSTRAP_ROTATION_MESSAGES,
  BootstrapCredentialRotationError,
  parseBootstrapUserIds,
} from '#modules/auth/utils/bootstrap_credential_rotation'

export default class SecurityRotateBootstrap extends BaseCommand {
  static commandName = 'security:rotate-bootstrap'
  static description = 'Rotate three explicit bootstrap accounts into a private credentials file'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    required: true,
    description: 'Exactly three distinct canonical user IDs separated by commas',
  })
  declare userIds: string

  @flags.string({
    required: true,
    description: 'Absolute new JSON path outside the application tree',
  })
  declare output: string

  async run(): Promise<void> {
    let result: BootstrapCredentialRotationResult
    try {
      const service = await this.app.container.make(BootstrapCredentialRotationService)
      result = await service.run({
        userIds: parseBootstrapUserIds(this.userIds),
        outputPath: this.output,
        applicationRoot: fileURLToPath(this.app.appRoot),
        requiredHostMountDirectory: this.app.inProduction
          ? BOOTSTRAP_CREDENTIAL_HOST_DIRECTORY
          : undefined,
      })
    } catch (error) {
      const safeError =
        error instanceof BootstrapCredentialRotationError
          ? error
          : new BootstrapCredentialRotationError(
              'rotation_failed',
              BOOTSTRAP_ROTATION_MESSAGES.rotationFailed
            )

      throw safeError
    }

    if (result.commitConfirmedAfterError) {
      this.logger.info('The database acknowledged the rotation during post-commit verification.')
    }
    this.logger.success(
      'Bootstrap credentials were rotated for three accounts and stored in the requested private file.'
    )
  }
}
