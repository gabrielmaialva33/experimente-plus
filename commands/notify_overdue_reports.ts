import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import ContentReportDeadlineService from '#modules/reviews/services/content_report_deadline_service'

/**
 * Names, once, every report that passed its moderation deadline — ADR-0027.
 *
 * Meant to be run periodically by the environment's scheduler, like
 * `purchases:process` and `analytics:prune`; the repository does not schedule
 * it. See docs/runbooks/content_report_deadlines.md.
 *
 * Output is counts only. A notice that could not be sent exits 1, so a
 * scheduler that watches exit codes sees it, and the next run retries it.
 */
export default class NotifyOverdueReports extends BaseCommand {
  static commandName = 'reports:notify-overdue'
  static description = 'Notify moderators, once, of reports that passed their moderation deadline'

  static options: CommandOptions = {
    startApp: true,
  }

  async run(): Promise<void> {
    const service = await this.app.container.make(ContentReportDeadlineService)
    const result = await service.notifyOverdue()
    const withoutRecipients = result.operations.filter(
      (operation) => operation.without_recipients
    ).length

    this.logger.info(
      [
        `operations: ${result.operations.length}`,
        `reports noticed: ${result.noticed}`,
        `operations without staff: ${withoutRecipients}`,
        `failed notices: ${result.failed}`,
      ].join(', ')
    )

    if (result.failed > 0) {
      this.exitCode = 1
    }
  }
}
