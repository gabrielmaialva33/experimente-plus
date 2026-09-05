import type { HealthCheckReport } from '@adonisjs/core/types/health'
import { test } from '@japa/runner'

import {
  HealthDiagnosticReporter,
  type HealthDiagnosticLogger,
} from '#modules/health/services/health_diagnostic_reporter'
import type { HealthReadinessOutcome } from '#modules/health/services/health_report_service'

type LogEntry = {
  level: 'error' | 'warn' | 'info'
  context: Record<string, unknown>
  message: string
}

function createLogger(entries: LogEntry[]): HealthDiagnosticLogger {
  return {
    error: (context, message) => entries.push({ level: 'error', context, message }),
    warn: (context, message) => entries.push({ level: 'warn', context, message }),
    info: (context, message) => entries.push({ level: 'info', context, message }),
  }
}

function reportOutcome(
  status: 'ok' | 'warning' | 'error',
  checkName = 'Database connection capacity check'
): HealthReadinessOutcome {
  const report: HealthCheckReport = {
    isHealthy: status !== 'error',
    status,
    finishedAt: new Date(),
    debugInfo: {
      pid: 1,
      uptime: 1,
      version: 'test',
      platform: 'test',
    },
    checks: [
      {
        isCached: false,
        name: checkName,
        status,
        message: 'internal diagnostic with connection counts',
        finishedAt: new Date(),
      },
    ],
  }

  return {
    statusCode: status === 'error' ? 503 : 200,
    body: {
      healthy: report.isHealthy,
      services: { database: { healthy: status !== 'error' } },
    },
    diagnostic: status === 'ok' ? undefined : { kind: 'report', report },
  }
}

test.group('Health diagnostic reporter', () => {
  test('suppresses repeated degradation until the cooldown elapses', ({ assert }) => {
    let now = 1_000
    const entries: LogEntry[] = []
    const reporter = new HealthDiagnosticReporter({
      clock: () => now,
      cooldownMilliseconds: 100,
    })
    const logger = createLogger(entries)
    const warning = reportOutcome('warning')

    reporter.record(warning, logger)
    reporter.record(warning, logger)
    now += 99
    reporter.record(warning, logger)

    assert.lengthOf(entries, 1)
    assert.equal(entries[0].level, 'warn')

    now += 1
    reporter.record(warning, logger)

    assert.lengthOf(entries, 2)
    assert.equal(entries[1].level, 'warn')
  })

  test('logs severity and cause transitions immediately', ({ assert }) => {
    const entries: LogEntry[] = []
    const reporter = new HealthDiagnosticReporter({ cooldownMilliseconds: 60_000 })
    const logger = createLogger(entries)

    reporter.record(reportOutcome('warning'), logger)
    reporter.record(reportOutcome('error'), logger)
    reporter.record(reportOutcome('error', 'Database health check'), logger)

    assert.deepEqual(
      entries.map((entry) => entry.level),
      ['warn', 'error', 'error']
    )
    assert.property(entries[1].context, 'health_report')
  })

  test('logs recovery once and starts a new degradation cycle afterward', ({ assert }) => {
    let now = 5_000
    const entries: LogEntry[] = []
    const reporter = new HealthDiagnosticReporter({
      clock: () => now,
      cooldownMilliseconds: 100,
    })
    const logger = createLogger(entries)

    reporter.record(reportOutcome('error'), logger)
    now += 40
    reporter.record(reportOutcome('ok'), logger)
    reporter.record(reportOutcome('ok'), logger)
    reporter.record(reportOutcome('warning'), logger)

    assert.deepEqual(
      entries.map((entry) => entry.level),
      ['error', 'info', 'warn']
    )
    assert.deepInclude(entries[1].context, {
      previous_status: 'error',
      degraded_for_ms: 40,
    })
    assert.equal(entries[1].message, 'Health readiness recovered')
  })
})
