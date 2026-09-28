import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import type IAnalytics from '#modules/analytics/interfaces/analytics_interface'
import AnalyticsRetentionRepository from '#modules/analytics/repositories/analytics_retention_repository'

@inject()
export default class AnalyticsRetentionService {
  constructor(private repository: AnalyticsRetentionRepository) {}

  async prune(): Promise<IAnalytics.RetentionResult> {
    return db.transaction((client) => this.repository.prune(client))
  }
}
