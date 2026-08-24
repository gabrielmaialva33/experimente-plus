import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import AnalyticsRetentionService from '#modules/analytics/services/analytics_retention_service'

export default class PruneAnalytics extends BaseCommand {
  static commandName = 'analytics:prune'
  static description = 'Delete analytics rows whose configured retention period has expired'

  static options: CommandOptions = {
    startApp: true,
  }

  async run(): Promise<void> {
    const service = await this.app.container.make(AnalyticsRetentionService)
    const result = await service.prune()

    this.logger.success(
      [
        `raw events: ${result.raw_events_deleted}`,
        `metric sessions: ${result.metric_sessions_deleted}`,
        `metrics: ${result.metrics_deleted}`,
        `search sessions: ${result.search_sessions_deleted}`,
        `search terms: ${result.search_terms_deleted}`,
      ].join(', ')
    )
  }
}
