import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import BadRequestException from '#exceptions/bad_request_exception'
import AnalyticsRetentionService from '#modules/analytics/services/analytics_retention_service'

export default class DiscardAnalyticsSessions extends BaseCommand {
  static commandName = 'analytics:discard-sessions'
  static description =
    'Discard the analytics of explicit anonymous sessions and correct the daily aggregates (dry run unless --apply)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.array({
    required: true,
    description: 'Full 64-character anonymous session hash; repeat the flag for more sessions',
  })
  declare session: string[]

  @flags.boolean({
    description: 'Delete and correct in one transaction; without it nothing is changed',
  })
  declare apply: boolean

  async run(): Promise<void> {
    const apply = this.apply === true
    const service = await this.app.container.make(AnalyticsRetentionService)

    let result: Awaited<ReturnType<AnalyticsRetentionService['discardSessions']>>
    try {
      result = await service.discardSessions(this.session ?? [], { apply })
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error
      this.logger.error(error.message)
      this.exitCode = 1
      return
    }

    // Counts only: never a session hash, a search term or a place.
    const byType = Object.entries(result.raw_events_by_type)
      .map(([type, count]) => `${type} ${count}`)
      .join(', ')
    const lines = [
      `sessions: ${result.sessions_requested} named, ${result.sessions_found} with raw events`,
      `raw events: ${result.raw_events_deleted}${byType ? ` (${byType})` : ''}`,
      `daily metrics: ${result.metrics_adjusted} adjusted, ${result.metrics_deleted} deleted; metric sessions: ${result.metric_sessions_deleted} deleted`,
      `search terms: ${result.search_terms_adjusted} adjusted, ${result.search_terms_deleted} deleted; search sessions: ${result.search_sessions_deleted} deleted`,
    ]
    for (const line of lines) this.logger.info(line)

    if (result.aggregate_sessions_without_raw_events > 0) {
      this.logger.warning(
        `${result.aggregate_sessions_without_raw_events} daily session rows of these sessions have no raw events left (past raw retention) and were left untouched`
      )
    }

    if (result.applied) {
      this.logger.success('Applied: the events were discarded and the aggregates corrected.')
    } else {
      this.logger.info('Dry run: nothing was changed. Run again with --apply to discard.')
    }
  }
}
