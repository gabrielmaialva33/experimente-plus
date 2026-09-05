import { healthChecks } from '#start/health'
import type { HttpContext } from '@adonisjs/core/http'

import { healthDiagnosticReporter } from '#modules/health/services/health_diagnostic_reporter'
import { runHealthReadiness } from '#modules/health/services/health_report_service'

export default class HealthChecksController {
  async handle({ logger, response }: HttpContext) {
    const outcome = await runHealthReadiness(healthChecks)
    healthDiagnosticReporter.record(outcome, logger)

    if (outcome.statusCode === 200) {
      return response.ok(outcome.body)
    }

    return response.serviceUnavailable(outcome.body)
  }
}
